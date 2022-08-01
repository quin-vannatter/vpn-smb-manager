let express = require("express");
let https = require("https");
let http = require("http");
let fs = require("fs");
let crypto = require("crypto");
let compression = require("compression");
let {
    exec
} = require("child_process");
let sqlite3 = require("sqlite3").verbose();

const headless = process.argv[2] === "headless";

let db = new sqlite3.Database("./vpn-smb-manager.db", sqlite3.OPEN_READWRITE, err => {
    if (err) {
        console.error(err);
    }
});

function Schema(tableName, properties, db) {
    let propMap = properties.map(key => ({
        jsonKey: key,
        sqlKey: key.match(/(^[a-z]+|[A-Z][a-z]*)/g).map(value => value.toUpperCase()).join("_")
    }));
    let insertStatement = `INSERT INTO ${tableName} (${propMap.map(property => property.sqlKey).join(", ")}) VALUES (${new Array(propMap.length).fill("?").join(", ")});`;
    let updateStatement = `UPDATE ${tableName} SET ${propMap.map(property => `${property.sqlKey} = ? `).join(", ")}`;
    let removeStatement = `DELETE FROM ${tableName}`;
    let selectStatement = `SELECT ${propMap.map(property => `${property.sqlKey} ${property.jsonKey}`).join(", ")} FROM ${tableName}`;
    let formatValue = (value) => {
        if (typeof (value) === "boolean") {
            return value ? 1 : 0;
        }
        return value && value.toString() || null;
    }
    let createSqlStatement = (sql, object) => {
        let values = [];
        if (!object) {
            return {
                sql: `${sql}`,
                values
            }
        }
        return {
            sql: `${sql} WHERE ${Object.keys(object).filter(key => propMap.some(property => property.jsonKey === key)).map(key => {
                let property = propMap.find(property => property.jsonKey ===  key);
                values.push(formatValue(object[key]));
                return `${property.sqlKey} = ?`;
            }).join(" AND ")};`,
            values
        };
    }
    let getValues = object => propMap.map(property => formatValue(object[property.jsonKey]));
    let newSchema = {
        findOne: (search) => {
            try
            {
                return new Promise(resolve => {
                    newSchema.find(search).then(rows => resolve(rows.length ? rows[0] : null));
                });
            }
            catch {
                return Promise.resolve(null)
            }
        },
        find: (search) => {
            try {
                return new Promise(resolve => {
                    let params = createSqlStatement(selectStatement, search);
                    db.all(params.sql, params.values, (err, rows) => {
                        if (err) {
                            console.error(err);
                        }
                        resolve(rows);
                    });
                });
            }
            catch {
                return Promise.resolve([]);
            }
        },
        create: (object) => {
            try {
                return new Promise(resolve => {
                    let values = getValues(object);
                    db.run(insertStatement, values, err => {
                        if (err) {
                            console.error(err);
                        }
                        resolve();
                    });
                });
            } catch {
                return Promise.resolve();
            }
        },
        update: (object, search) => {
            try {
                return new Promise(resolve => {
                    let values = getValues(object);
                    let params = createSqlStatement(updateStatement, search);
                    db.run(params.sql, values.concat(params.values), err => {
                        if (err) {
                            console.error(err);
                        }
                        resolve();
                    })
                });
            } catch {
                return Promise.resolve();
            }
        },
        delete: (search) => {
            try {
                return new Promise(resolve => {
                    let params = createSqlStatement(removeStatement, search);
                    db.run(params.sql, params.values, err => {
                        if (err) {
                            console.error(err);
                        }
                        resolve();
                    });
                });
            } catch {
                return Promise.resolve();
            }
        }
    }
    return newSchema;
}

let server;

let app = express();
app.use(compression());
app.use(express.json());

let port;

if(!headless) {
    let key = fs.readFileSync("/etc/letsencrypt/live/yanisin.com/privkey.pem", "utf8");
    let cert = fs.readFileSync("/etc/letsencrypt/live/yanisin.com/fullchain.pem", "utf8");

    port = 443;
    server = https.createServer({
        key,
        cert
    }, app);
} else {
    server = http.createServer(app);
    port = 8081;
}

const GATEWAY_TIMEOUT = 1000 * 60 * 20;
const TOKEN_LIFESPAN = 3;
const INVITE_TIMEOUT = 1000 * 60;
const USERNAME_REXEX = /^[a-z_]{3,25}$/;
const PASSWORD_REGEX = /^.{4,50}$/;
const REMOVE_PROPERTIES = [
    "_id",
    "passwordHash",
    "expirationDate",
    "token"
];

const Certificate = Schema("CERTIFICATES", [
    "id",
    "username"
], db);

const User = Schema("USERS", [
    "username",
    "passwordHash",
    "isAdmin",
    "expirationDate",
    "token",
    "smbPassword"
], db);

let inviteCodes = [];

function createId() {
    return Math.random().toString(36).split(".")[1].toUpperCase();
}

function checkToken(token) {
    return new Promise(resolve => {
        User.findOne({
            token
        }).then(user => {
            let currentDate = new Date();
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
    let date = new Date();
    date.setDate(date.getDate() + TOKEN_LIFESPAN);
    return date;
}

function authenticate(username, password) {
    return new Promise(resolve => {
        User.findOne({
            username
        }).then(user => {
            if (user && validatePassword(user.passwordHash, password)) {
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
    let decodedPassword = Buffer.from(password, "base64").toString("utf-8");
    return passwordHash === applyHash(decodedPassword);
}

function applyHash(password) {
    let decodedPassword = Buffer.from(password, "base64").toString("utf-8");
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
                }).then(() => createSmbUser(username, smbPassword).then(() => resolve(true)));
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
    let existingInviteCode = inviteCodes.find(value => value.username === username);
    if (existingInviteCode) {
        return existingInviteCode.id;
    } else {
        let id = createId();
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
                let result = [];
                ids.forEach(id => {
                    let values = stdout.split("\n").filter(val => val.indexOf(id) !== -1);
                    if (values.length > 0 && values[values.length - 1].indexOf("Peer Connection Initiated") !== -1) {
                        result.push(id);
                    }
                })
                resolve(result);
            } else {
                resolve([]);
            }
        });
    });
}

function createSmbUser(username, smbPassword) {
    return new Promise(resolve => {
        exec([__dirname + "/scripts/create_user.sh", username, smbPassword].join(" "), (err) => {
            if (!err) {
                resolve();
            } else {
                console.error(err);
                resolve();
            }
        });
    });
}

function updateUserDirectories(username) {
    return new Promise(resolve => {
        exec([__dirname + "/scripts/update_shares.sh", username].join(" "), (err) => {
            if (!err) {
                resolve();
            } else {
                console.error(err);
                resolve();
            }
        });
    })
}

function removeSmbUser(username) {
    return new Promise(resolve => {
        exec([__dirname + "/scripts/remove_user.sh", username].join(" "), (err) => {
            if (!err) {
                resolve();
            } else {
                console.error(err);
                resolve();
            }
        });
    });
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

function createCertificate(username, password) {
    return new Promise(resolve => {
        let id = createId();
        let decodedPassword = Buffer.from(password, "base64").toString("utf-8");
        exec([__dirname + "/scripts/create_certificate.sh", __dirname, id, decodedPassword].join(" "), (err) => {
            if (!err) {
                Certificate.create({
                    id,
                    username
                }).then(() => resolve(id));
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
            Promise.all(certificates.map(certificate => {
                if (certificate.id) {
                    return deleteCertificateById(certificate.id);
                } else {
                    return Promise.resolve();
                }
            })).then(() => resolve());
        });
    });
}

function deleteCertificateById(id) {
    return new Promise(resolve => {
        exec([__dirname + "/scripts/revoke_certificate.sh", __dirname, id].join(" "), () => {
            Certificate.delete({
                id
            }).then(() => resolve());
        });
    })
}

function getCertificate(username, type) {
    return new Promise(resolve => {
        getUnusedCertificates(username).then(certificates => {
            let id;
            if (certificates.length) {
                id = certificates[0].id;
            } else {
                id = createId();
            }
            executeGetCertificate(id, type, resolve);
        })
    });
}

function handleOutput(err, stdout, callback) {
    if (!err) {
        callback(stdout);
    } else {
        console.error(err);
        callback();
    }
}

function executeGetCertificate(id, type, callback) {
    exec([__dirname + "/scripts/get_certificate.sh", __dirname, id, type].join(" "), (err, stdout) => handleOutput(err, stdout, callback));
}

function executeGetSmbShare(username, smbPassword, callback) {
    exec([__dirname + "/scripts/get_smb_share.sh", __dirname, username, smbPassword].join(" "), (err, stdout) => handleOutput(err, stdout, callback));
}

function getCertificateById(username, type, id) {
    return new Promise(resolve => {
        Certificate.findOne({
            id
        }).then(certificate => {
            if (certificate && certificate.username === username) {
                executeGetCertificate(id, type, resolve);
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
                let ids = connectedCertificates.map(connectedCertificate => connectedCertificate.id);
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
    return new Promise(resolve => {
        let password = req.body.password;
        let type = req.body.type === "tap" ? "tap" : "tun";
        if (!validatePassword(req.user.passwordHash, password) || !password) {
            res.status(401);
            resolve();
        } else {
            createCertificate(req.user.username, password).then(id => {
                getCertificateById(req.user.username, type, id).then(result => resolve(result));
            });
        }
    });
});

createCertificateEndpoint("get", "certificates/download/:type", req => {
    return getCertificate(req.user.username, req.params.type === "tap" ? "tap" : "tun");
});

createCertificateEndpoint("get", "certificates/download/:id/:type", req => {
    return getCertificateById(req.user.username, req.params.type === "tap" ? "tap" : "tun", req.params.id);
});

createEndpoint("get", "certificates", () => {
    return new Promise(resolve => {
        Certificate.find().then(certificates => {
            let certificateIds = certificates.map(certificate => certificate.id);
            getConnectedCertificates(certificateIds).then(connectedIds => {
                resolve(cleanOutput(certificates).map(certificate => ({
                    isConnected: connectedIds.indexOf(certificate.id) !== -1,
                    ...certificate
                })));
            });
        })
    });
});

createEndpoint("delete", "certificates/:id", req => {
    return new Promise(resolve => {
        Certificate.findOne({
            id: req.params.id
        }).then(certificate => {
            if (!req.user.isAdmin && certificate.username !== req.user.username) {
                res.status(403);
                resolve();
            }
            if (certificate.id) {
                deleteCertificateById(certificate.id).then(value => resolve(value));
            } else {
                resolve();
            }
        })
    })
});

createEndpoint("get", "users/current", req => {
    return Promise.resolve(cleanOutput(req.user));
});

createEndpoint("get", "users/smb", (req, res) => {
    res.setHeader("Content-Type", "	application/bat");
    res.setHeader("Content-Disposition", `attachment; filename=${req.user.username}-drive.bat`);
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    return new Promise(resolve => executeGetSmbShare(req.user.username, req.user.smbPassword, resolve));
}, true, false, false);

createEndpoint("post", "users/login", (req, res) => {
    return new Promise(resolve => {
        let username = req.body.username;
        let password = req.body.password;
        authenticate(username, password).then(id => {
            res.status(id ? 200 : 401);
            if (id) {
                updateUserDirectories(username).then(() => resolve({ id }));
            } else {
                resolve({
                    id
                });
            }
        });
    });
}, false);

createEndpoint("post", "users/invite", req => {
    let inviteCode = createInviteCode(req.user.username);
    return Promise.resolve({
        inviteCode
    });
}, true, true);

createEndpoint("post", "users", (req, res) => {
    return new Promise(resolve => {
        let username = req.body.username;
        let password = Buffer.from(req.body.password, "base64").toString("utf-8");
        let inviteCode = inviteCodes.find(value => value.id === req.body.inviteCode);
        let smbPassword = createId();

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
        let username = req.body.username;
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
        let username = req.params.username;
        User.findOne({
            username
        }).then(user => {
            if (user && req.user.username === username || req.user.isAdmin) {
                deleteCertificates(username).then(() => {
                    User.delete({ username }).then(() => {
                        removeSmbUser(username).then(() => {
                            resolve();
                        });
                    });
                });
            } else {
                resolve();
            }
        });
    })
}, true);

if (!headless) {
    app.get("*.*", express.static("./ui"))
    app.all("*", (req, res) => {
        res.status(200).sendFile("/", { root: "./ui" });
    });
}
User.find().then(users => {
    if (!users.some(user => user.isAdmin)) {
        console.log("No users registered. Start the client, go to the login page and add the following to the address bar:")
        console.log("/" + createInviteCode(undefined, true));
    }
});

server.setTimeout(GATEWAY_TIMEOUT);
server.listen(port);
console.log(`Running on Port: ${port}`);