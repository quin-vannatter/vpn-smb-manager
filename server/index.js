var express = require("express");
var https = require("https");
var fs = require("fs");
var crypto = require("crypto");
var compression = require("compression");
var {
    exec
} = require("child_process");
var sqlite3 = require("sqlite3").verbose();

let db = new sqlite3.Database("./vpn-smb-manager.db", sqlite3.OPEN_READWRITE, err => {
    if (err) {
        console.error(err);
    }
});

function Schema(tableName, properties, db) {
    var propMap = properties.map(key => ({
        jsonKey: key,
        sqlKey: key.match(/(^[a-z]+|[A-Z][a-z]*)/g).map(value => value.toUpperCase()).join("_")
    }));
    var insertStatement = `INSERT INTO ${tableName} (${propMap.map(property => property.sqlKey).join(", ")}) VALUES (${new Array(propMap.length).fill("?").join(", ")});`;
    var updateStatement = `UPDATE ${tableName} SET ${propMap.map(property => `${property.sqlKey} = ? `).join(", ")}`;
    var removeStatement = `DELETE FROM ${tableName}`;
    var selectStatement = `SELECT ${propMap.map(property => `${property.sqlKey} ${property.jsonKey}`).join(", ")} FROM ${tableName}`;
    var formatValue = (value) => {
        if (typeof (value) === "boolean") {
            return value ? 1 : 0;
        }
        return value && value.toString() || null;
    }
    var createSqlStatement = (sql, object) => {
        var values = [];
        if (!object) {
            return {
                sql: `${sql}`,
                values
            }
        }
        return {
            sql: `${sql} WHERE ${Object.keys(object).filter(key => propMap.some(property => property.jsonKey === key)).map(key => {
                var property = propMap.find(property => property.jsonKey ===  key);
                values.push(formatValue(object[key]));
                return `${property.sqlKey} = ?`;
            }).join(" AND ")};`,
            values
        };
    }
    var getValues = object => propMap.map(property => formatValue(object[property.jsonKey]));
    var newSchema = {
        findOne: (search) => {
            return new Promise(resolve => {
                newSchema.find(search).then(rows => resolve(rows.length ? rows[0] : null));
            })
        },
        find: (search) => {
            return new Promise(resolve => {
                var params = createSqlStatement(selectStatement, search);
                db.all(params.sql, params.values, (err, rows) => {
                    if (err) {
                        console.error(err);
                    }
                    resolve(rows);
                });
            })
        },
        create: (object) => {
            return new Promise(resolve => {
                var values = getValues(object);
                db.run(insertStatement, values, err => {
                    if (err) {
                        console.error(err);
                    }
                    resolve();
                });
            });
        },
        update: (object, search) => {
            return new Promise(resolve => {
                var values = getValues(object);
                var params = createSqlStatement(updateStatement, search);
                db.run(params.sql, values.concat(params.values), err => {
                    if (err) {
                        console.error(err);
                    }
                    resolve();
                })
            });
        },
        delete: (search) => {
            return new Promise(resolve => {
                var params = createSqlStatement(removeStatement, search);
                db.run(params.sql, params.values, err => {
                    if (err) {
                        console.error(err);
                    }
                    resolve();
                });
            });
        }
    }
    return newSchema;
}

var httpsServer;

var app = express();
app.use(compression());
app.use(express.json());

try {
    var key = fs.readFileSync("/etc/letsencrypt/live/yanisin.com/privkey.pem", "utf8");
    var cert = fs.readFileSync("/etc/letsencrypt/live/yanisin.com/fullchain.pem", "utf8");

    httpsServer = https.createServer({
        key,
        cert
    }, app);
} catch {
    httpsServer = undefined;
}

const TOKEN_LIFESPAN = 3;
const INVITE_TIMEOUT = 1000 * 60;
const USERNAME_REXEX = /^\w{6,10}$/;
const PASSWORD_REGEX = /^.{4,15}$/;
const headless = process.argv[2] === "headless";
const REMOVE_PROPERTIES = [
    "_id",
    "passwordHash",
    "expirationDate",
    "token",
    "smbPassword"
];

const Certificate = Schema("CERTIFICATES", [
    "id",
    "username",
    "label"
], db);

const User = Schema("USERS", [
    "username",
    "passwordHash",
    "isAdmin",
    "expirationDate",
    "token",
    "smbPassword"
], db);

var inviteCodes = [];

function createId() {
    return Math.random().toString(36).split(".")[1].toUpperCase();
}

function checkToken(token) {
    return new Promise(resolve => {
        User.findOne({
            token
        }).then(user => {
            var currentDate = new Date();
            if (user && currentDate < new Date(user.expirationDate)) {
                User.update(user, {
                    username: user.username
                }).then(() => resolve(user))
            } else {
                resolve();
            }
        });
    });
}

function getExpirationDate() {
    var date = new Date();
    date.setDate(date.getDate() + TOKEN_LIFESPAN);
    return date;
}

function authenticate(username, password) {
    return new Promise(resolve => {
        User.findOne({
            username
        }).then(user => {
            if (validatePassword(user.passwordHash, password)) {
                user.expirationDate = getExpirationDate();
                user.token = createId();
                User.update(user, {
                    username
                }).then(() => {
                    resolve(user.token);
                })
            } else {
                resolve();
            }
        });
    });
}

function validatePassword(passwordHash, password) {
    var decodedPassword = Buffer.from(password, "base64").toString("utf-8");
    return passwordHash === applyHash(decodedPassword);
}

function applyHash(password) {
    var decodedPassword = Buffer.from(password, "base64").toString("utf-8");
    return crypto.createHash("sha256")
        .update(decodedPassword)
        .digest("hex")
}

function createUser(username, password, isAdmin, smbPassword) {
    return new Promise(resolve => {
        User.findOne({
            username
        }).then(user => {
            if (user == null) {
                User.create({
                    username,
                    passwordHash: applyHash(password),
                    isAdmin,
                    smbPassword
                }).then(() => resolve(true));
            }
            resolve(false);
        })
    });
}

function getUsers() {
    return new Promise(resolve => {
        User.find().then(users => {
            Promise.all(users.map(user => {
                return new Promise((resolveUser) => {
                    isUserConnected(user.username).then(isConnected => resolveUser({
                        isConnected,
                        ...user
                    }));
                });
            })).then(resolvedUsers => resolve(cleanOutput(resolvedUsers)));
        })
    });
}

function createInviteCode(username = undefined, isAdmin = false) {
    var existingInviteCode = inviteCodes.find(value => value.username === username);
    if (existingInviteCode) {
        return existingInviteCode.id;
    } else {
        var id = createId();
        inviteCodes.push({
            id,
            isAdmin,
            username
        });
        setTimeout(() => inviteCodes = inviteCodes.filter(value => value.id !== id), INVITE_TIMEOUT);
        return id;
    }
}

function getConnectedCertificates(ids) {
    return new Promise(resolve => {
        exec(__dirname + "/scripts/list_connections.sh", (err, stdout) => {
            if (!err) {
                var result = [];
                ids.forEach(id => {
                    var values = stdout.split("\n").filter(val => val.indexOf(id) !== -1);
                    if (values.length > 0 && values[values.length - 1].indexOf("Peer Connection Initiated") !== -1) {
                        result.push(id);
                    }
                })
                resolve(result);
            } else {
                console.error(err);
                resolve();
            }
        });
    })
}

function isUserConnected(username) {
    return new Promise(resolve => {
        Certificate.find({
            username
        }).then(certificates => {
            getConnectedCertificates(certificates.map(certificate => certificate.id)).then(results => resolve(results.length > 0));
        });
    });
}

function createCertificate(username, password, label) {
    return new Promise(resolve => {
        var id = createId();
        exec([__dirname + "/scripts/create_certificate.sh", id, password].join(" "), (err, stdout) => {
            if (!err) {
                Certificate.create({
                    id,
                    username,
                    label
                }).then(() => resolve(stdout));
            } else {
                console.error(err);
                resolve();
            }
        });
    });
}

function deleteCertificates(username) {
    return new Promise(resolve => {
        Certificate.find({
            username
        }).then(certificates => {
            Promise.all(certificates.map(certificate => deleteCertificateById(certificate.id))).then(() => resolve());
        });
    });
}

function deleteCertificateById(id) {
    return new Promise(resolve => {
        exec([__dirname + "/scripts/revoke_certificate.sh", id].join(" "), err => {
            if (!err) {
                Certificate.delete({
                    id
                }).then(() => resolve());
            }
        });
    })
}

function getCertificate(username) {
    return new Promise(resolve => {
        getUnusedCertificates(username).then(certificates => {
            var id;
            if (certificates.length) {
                id = certificates[0].id;
            } else {
                id = createId();
            }
            executeGetCertificate(id, resolve);
        })
    });
}

function executeGetCertificate(id, callback) {
    exec([__dirname + "/scripts/get_certificate.sh", id].join(" "), (err, stdout) => {
        if (!err) {
            callback(stdout);
        } else {
            console.error(err);
            callback();
        }
    });
}

function getCertificateById(username, id) {
    return new Promise(resolve => {
        Certificate.findOne({
            id
        }).then(certificate => {
            if (certificate && certificate.username === username) {
                executeGetCertificate(id, resolve);
            }
        });
    });
}

function getUnusedCertificates(username) {
    return new Promise(resolve => {
        Certificate.find({
            username
        }).then(certificates => {
            getConnectedCertificates(certificates.map(certificate => certificate.id)).then(connectedCertificates => {
                var ids = connectedCertificates.map(connectedCertificate => connectedCertificate.id);
                resolve(certificates.filter(certificate => ids.indexOf(certificate.id) === -1));
            });
        })
    })
}

function cleanOutput(value) {
    [].concat(value).forEach(item => REMOVE_PROPERTIES.forEach(property => delete item[property]));
    return value;
}

function createCertificateEndpoint(action, path, fn) {
    createEndpoint(action, path, (req, res) => {
        res.setHeader("Content-Type", "application/x-openvpn-profile");
        res.setHeader("Content-Disposition", `attachment; filename=${req.user.username}.ovpn`);
        res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
        return fn(req, res);
    }, true, false, false);
}

function createEndpoint(action, path, fn, isAuthenticated = true, isAdmin = false, isJson = true) {
    app[action](`/api/${path}`, (req, res) => {
        new Promise(resolve => {
            if (isAuthenticated) {
                checkToken(req.get("Authorization") || req.query.authToken).then(user => {
                    if (!user) {
                        res.status(401);
                        res.end(JSON.stringify({}));
                        return;
                    } else if (isAdmin && !user.isAdmin) {
                        res.status(403);
                        res.end(JSON.stringify({}));
                        return;
                    } else {
                        req.user = user;
                    }
                    resolve();
                });
            } else {
                resolve();
            }
        }).then(() => {
            if (isJson) {
                res.setHeader("Content-Type", "application/json");
                fn(req, res).then(result => {
                    res.end(JSON.stringify(result || {}));
                })
            } else {
                fn(req, res).then(result => {
                    res.end(result);
                })
            }
        })
    });
}

createEndpoint("get", "users", getUsers);

createCertificateEndpoint("post", "certificates", (req, res) => {
    var password = req.body.password;
    if (!validatePassword(req.user.passwordHash, password) || !password) {
        res.status(401);
        return Promise.resolve();
    } else {
        return createCertificate(req.user.username, password);
    }
});

createCertificateEndpoint("get", "certificates/download", req => {
    return getCertificate(req.user.username);
});

createCertificateEndpoint("get", "certificates/:id/download", req => {
    return getCertificateById(req.user.username, req.params.id);
});

createEndpoint("get", "certificates", () => {
    return new Promise(resolve => {
        Certificate.find().then(certificates => {
            var certificateIds = certificates.map(certificate => certificate.id);
            getConnectedCertificates(certificateIds).then(connectedIds => {
                resolve(cleanOutput(certificates).map(certificate => ({
                    isConnected: connectedIds.indexOf(certificate.id),
                    ...certificate
                })));
            });
        })
    });
});

createEndpoint("delete", "certificates/:id", req => {
    return new Promise(resolve => {
        Certificate.findOne({
            id: req.parms.id
        }).then(certificate => {
            if (!req.user.isAdmin && certificate.username !== req.user.username) {
                res.status(403);
                resolve();
            }
            deleteCertificateById(certificate.id).then(value => resolve(value));
        })
    })
});

createEndpoint("delete", "users/:username/certificates", req => {
    var username = req.parms.username;
    if (!req.user.isAdmin && username !== req.user.username) {
        res.status(403);
        return Promise.resolve();
    }
    return deleteCertificates(username);
});

createEndpoint("get", "users/current", req => {
    return Promise.resolve(cleanOutput(req.user));
})

createEndpoint("post", "users/login", (req, res) => {
    return new Promise(resolve => {
        var username = req.body.username;
        var password = req.body.password;
        authenticate(username, password).then(id => {
            res.status(id ? 200 : 401);
            resolve({
                id
            })
        });
    });
}, false);

createEndpoint("post", "users/invite", req => {
    var inviteCode = createInviteCode(req.user.username);
    return Promise.resolve({
        inviteCode
    });
}, true, true);

createEndpoint("post", "users", (req, res) => {
    return new Promise(resolve => {
        var username = req.body.username;
        var password = Buffer.from(req.body.password, "base64").toString("utf-8");
        var inviteCode = inviteCodes.find(value => value.id === req.body.inviteCode);
        var smbPassword = createId();

        if (USERNAME_REXEX.test(username) && PASSWORD_REGEX.test(password) && inviteCode) {
            createUser(username, password, inviteCode.isAdmin, smbPassword).then(() => {
                inviteCodes = inviteCodes.filter(value => value.inviteCode !== inviteCode.id);
                resolve();
            });
        } else {
            res.status(400);
            resolve();
        }
    });
}, false);

createEndpoint("put", "users/promote", req => {
    return new Promise(resolve => {
        var username = req.body.username;
        User.findOne({
            username
        }).then(user => {
            if (user) {
                user.isAdmin = true;
                User.update(user, {
                    username
                }).then(() => resolve());
            } else {
                resolve();
            }
        });
    })
}, true, true);

createEndpoint("delete", "users/:username", req => {
    return new Promise(resolve => {
        var username = req.params.username;
        User.findOne({
            username
        }).then(user => {
            if (user) {
                deleteCertificates(username).then()
                return user.remove({ username });
            } else {
                resolve();
            }
        });
    })
}, true, true);

if (!headless) {
    app.get("*.*", express.static("./ui"))
    app.all("*", (req, res) => {
        res.status(200).sendFile("/", { root: "./ui" });
    });
}
User.find().then(users => {
    if (!users.length) {
        console.log(createInviteCode(undefined, true));
    }
});

if (httpsServer) {
    console.log("Running on Port: 443");
    httpsServer.listen(443);
} else {
    console.log("Running on Port: 8081");
    app.listen(8081);
}