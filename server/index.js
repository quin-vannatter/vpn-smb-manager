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
let createWrapper = require("simple-sqlite3-wrapper").createWrapper;

const headless = process.argv[2] === "headless";

const userScriptsLocation = (user, drive) => `/share/${drive}/${user}/private/scripts`;
const userScripts = {};

let db = new sqlite3.Database("./vpn-smb-manager.db", sqlite3.OPEN_READWRITE, err => {
    if (err) {
        console.error(err);
    }
});

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
const GUEST_GRACE_PERIOD = 1000 * 60 * 10;
const GUEST_CHECK_INT = 1000 * 60 * 3;
const TOKEN_LIFESPAN = 3;
const INVITE_TIMEOUT = 1000 * 60 * 5;
const USERNAME_REXEX = /^[a-z_]{3,25}$/;
const PASSWORD_REGEX = /^.{4,50}$/;
const REMOVE_PROPERTIES = [
    "_id",
    "passwordHash",
    "expirationDate",
    "token"
];

const Certificate = createWrapper("CERTIFICATES", [
    "id",
    "username"
], db);

const User = createWrapper("USERS", [
    "username",
    "passwordHash",
    "isAdmin",
    "expirationDate",
    "token",
    "smbPassword"
], db);

let inviteCodes = [];
let guestInviteCodes = [];
let guestIds = [];

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
            })).then(resolvedUsers => {
                checkConnectedGuestCertificates().then(guestCount => {
                    resolve({
                        guestCount,
                        resolvedUsers: cleanOutput(resolvedUsers)
                    });
                });
            });
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

function evaluateUserScripts() {
    return new Promise(resolve => Promise.all([getUsers(), getCurrentDrives()]).then(values => {
        var locations = values[0].resolvedUsers.flatMap(user => values[1].map(drive => ({ username: user.username, fileLocation: userScriptsLocation(user.username, drive) })));
        Promise.all(locations.map(location => new Promise(resolve => {
            exec([__dirname + "/scripts/list_scripts.sh", location.fileLocation].join(" "), (err, stdout) => {
                if (!err) {
                    resolve({
                        fileLocations: stdout.split("\n").filter(x => x),
                        username: location.username
                    });
                } else {
                    console.error(err);
                    resolve([]);
                }
            });
        }))).then(results => {
            results.forEach(result => result.fileLocations.forEach(script => {
                let scriptContent = fs.readFileSync(script).toString();
                if (/^return/.test(scriptContent)) {
                    const id = createId();
                    scriptContent = scriptContent.replace(/^return/, `userScripts["${id}"] =`);
                    try {
                        eval(scriptContent);
                        userScripts[id].users.push(result.username);
                        userScripts[id] = {
                            ...userScripts[id],
                            owner: result.username,
                            name: `${script.split("/").pop()}`,
                            script,
                            id
                        }
                    } catch (ex) {
                        console.error(ex);
                    }
                }
            }));
            resolve();
        });
    }));
}

function saveUserScriptData(script, data) {
    const path = `${script}.json`;
    fs.writeFileSync(path, JSON.stringify(data));
}

function loadUserScriptData(script) {
    let data;
    const path = `${script}.json`;
    try {
        data = JSON.parse(fs.readFileSync(path));
    } catch {
        data = {};
        saveUserScriptData(script, data);
    }
    return data;
}

function getUserScripts(username) {
    return new Promise(resolve => evaluateUserScripts().then(() => resolve(Object.entries(userScripts)
        .filter(entry => entry[1].users.includes(username)).map(entry => ({
        name: entry[1].name,
        id: entry[1].id,
        owner: entry[1].owner,
        actions: entry[1].actions.map(({ name, signature }) => ({ name, signature })),
        display: entry[1].display.length
    })))));
}

function getCurrentDrives() {
    return new Promise(resolve => {
        exec(__dirname + "/scripts/list_drives.sh", (err, stdout) => {
            if (!err) {
                resolve(stdout.split("\n").filter(x => x));
            } else {
                resolve([]);
            }
        });
    });
}

function createGuestCode(username = undefined) {
    return new Promise(resolve => {
        let existingInviteCode = guestInviteCodes.find(value => value.username === username);
        if (existingInviteCode) {
            return resolve(existingInviteCode.id);
        } else {
            let id = createId();
            createCertificate(undefined).then(certificateId => {
                guestInviteCodes.push({
                    id,
                    isAdmin: false,
                    username,
                    certificateId
                });
                setTimeout(() => guestInviteCodes = guestInviteCodes.filter(value => value.id !== id), INVITE_TIMEOUT);
                setTimeout(() => guestIds.splice(guestIds.indexOf(certificateId), 1), GUEST_GRACE_PERIOD);
                guestIds.push(certificateId);
                resolve(id);
            });
        }
    });
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

function checkConnectedGuestCertificates() {
    return new Promise(resolve => {
        Certificate.find({
            username: undefined
        }).then(certificates => {
            getConnectedCertificates(certificates.map(certificate => certificate.id)).then(results => {
                const expiredGuestCertificates = certificates.filter(certificate => !results.includes(certificate.id) && !guestIds.includes(certificate.id));
                Promise.all(expiredGuestCertificates.map(certificate => deleteCertificateById(certificate.id))).then(() => resolve(certificates.length - expiredGuestCertificates.length));
            });
        });
    });
}

function createCertificate(username, password) {
    return new Promise(resolve => {
        let id = createId();
        let params = [__dirname + "/scripts/create_certificate.sh", __dirname, id];
        if (password != undefined) {
            params.push(Buffer.from(password, "base64").toString("utf-8"));
        }

        exec(params.join(" "), (err) => {
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

function getGuestCertificate(id, type) {
    return new Promise(resolve => {
        let certificateId = guestInviteCodes.find(item => item.id === id)?.certificateId;
        if (certificateId != null) {
            executeGetCertificate(certificateId, type, resolve);
        }
    })
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

function createCertificateEndpoint(action, path, fn, isAuthenticated = true) {
    createEndpoint(action, path, (req, res) => {
        res.setHeader("Content-Type", "application/x-openvpn-profile");
        res.setHeader("Content-Disposition", `attachment; filename=${req?.user?.username || 'yanisin-guest'}.ovpn`);
        res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
        return fn(req, res);
    }, isAuthenticated, false, false);
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

createEndpoint("get", "users", () => getUsers());

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
    return getCertificateById(req?.user?.username, req.params.type === "tap" ? "tap" : "tun", req.params.id);
});

createCertificateEndpoint("get", "certificates/guest/download/:id/:type", req => {
    return getGuestCertificate(req.params.id, req.params.type === "tap" ? "tap" : "tun");
}, false);

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

createEndpoint("get", "users/scripts", req => {
    return Promise.resolve(getUserScripts(req.user.username));
});

createEndpoint("get", "users/init", () => {
    return new Promise(resolve => User.find().then(users => {
        if (!users.some(user => user.isAdmin)) {
            var inviteCode = createInviteCode(undefined, true);
            resolve({ inviteCode });
        } else {
            resolve({});
        }
    }));
}, false);

createEndpoint("get", "users/scripts/display/:id/:index", req => {
    return new Promise(resolve => {
        const script = userScripts[req.params.id];
        const index = parseInt(req.params.index);
        if (script != undefined && script.users.includes(req.user.username) && !isNaN(index) && index < script.display.length) {
            const data = loadUserScriptData(script.script);
            resolve(script.display[index](data));
        }
    });
});

createEndpoint("get", "users/smb", (req, res) => {
    res.setHeader("Content-Type", "	application/bat");
    res.setHeader("Content-Disposition", `attachment; filename=${req.user.username}-drive.bat`);
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    return new Promise(resolve => executeGetSmbShare(req.user.username, req.user.smbPassword, resolve));
}, true, false, false);

createEndpoint("post", "users/login", (req, res) => {
    evaluateUserScripts();
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

createEndpoint("post", "users/guest", req => {
    return createGuestCode(req.user.username).then(id => ({ inviteCode: id }));
}, true);

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

setInterval(() => checkConnectedGuestCertificates(), GUEST_CHECK_INT);

server.setTimeout(GATEWAY_TIMEOUT);
server.listen(port);
console.log(`Running on Port: ${port}`);