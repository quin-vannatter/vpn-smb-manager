let express = require("express");
let https = require("https");
let http = require("http");
let fs = require("fs");
let crypto = require("crypto");
let compression = require("compression");
let {
    exec
} = require("child_process");
const { stdout } = require("process");
let sqlite3 = require("sqlite3").verbose();
let createWrapper = require("simple-sqlite3-wrapper").createWrapper;

const headless = process.argv[3] === "headless";
const serverDomain = process.argv[2];

console.log(`Running on domain ${serverDomain}`);

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
    let key = fs.readFileSync(`/etc/letsencrypt/live/${serverDomain}/privkey.pem`, "utf8");
    let cert = fs.readFileSync(`/etc/letsencrypt/live/${serverDomain}/fullchain.pem`, "utf8");

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
const CERTIFICATE_CONNECTED_REGEX = id => new RegExp(`([2-9][0-9]{3}-[0-1][0-9]-[0-9]{1,2} [0-2][0-9]:[0-5][0-9]:[0-5][0-9]).+\\[${id}\\] Peer Connection Initiated with \\[AF_INET\\]([0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}:[0-9]{4,6})`, "g");
const CERTIFICATE_DISCONNECTED_REGEX = id => new RegExp(`([2-9][0-9]{3}-[0-1][0-9]-[0-9]{1,2} [0-2][0-9]:[0-5][0-9]:[0-5][0-9]) ${id}.+client-instance exiting`, "g");
const CERTIFICATE_HARDWARE_ADDRESS_REGEX = addr => new RegExp(`([2-9][0-9]{3}-[0-1][0-9]-[0-9]{1,2} [0-2][0-9]:[0-5][0-9]:[0-5][0-9]) ${addr.replaceAll(".", "\\.")} peer info: IV_HWADDR=([a-z0-9]{2}:[a-z0-9]{2}:[a-z0-9]{2}:[a-z0-9]{2}:[a-z0-9]{2}:[a-z0-9]{2})`, "g");
const REMOVE_PROPERTIES = [
    "_id",
    "passwordHash",
    "expirationDate",
    "token"
];
const FAIL_WAIT_TIME = 240000;

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

const Device = createWrapper("DEVICES", [
    "mac",
    "name"
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
            } else {
                resolve(false);
            }
        })
    });
}

function getUsers() {
    return new Promise(resolve => {
        User.find().then(users => {
            Promise.all(users.map(user => {
                return new Promise((resolveUser) => {
                    isUserConnected(user.username).then(connected => resolveUser({
                        connected,
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

function getConnectionInfo(id, stdout) {
    const connectionRegex = CERTIFICATE_CONNECTED_REGEX(id)
    const disconnectedRegex = CERTIFICATE_DISCONNECTED_REGEX(id);
    const connectionResults = [];
    const hardwareResults = [];
    let match;
    while((match = connectionRegex.exec(stdout)) !== null) {
        try {
            connectionResults.push({
                date: new Date(match[1]),
                addr: match[2],
                connected: true
            })
        } catch {
            // Do nothing.
        }
    }
    while((match = disconnectedRegex.exec(stdout)) !== null) {
        try {
            connectionResults.push({
                date: new Date(match[1]),
                connected: false
            });
        } catch {
            // Do nothing.
        }
    }
    const addr = connectionResults.filter(x => x.connected).sort((a,b) => b.date - a.date)?.[0]?.addr;
    if (addr !== undefined) {
        const regex = CERTIFICATE_HARDWARE_ADDRESS_REGEX(addr);
        try {
            while((match = regex.exec(stdout)) !== null) {
                hardwareResults.push({
                    date: new Date(match[1]),
                    addr: match[2]
                })
            }
        } catch {
            // Do nothing.
        }
    }
    return {
        id,
        connected: connectionResults.sort((a, b) => b.date - a.date).find(x => x)?.connected || false,
        addr: hardwareResults.sort((a, b) => b.date - a.date).find(x => x)?.addr
    }
}

function getConnectedCertificates(ids) {
    return new Promise(resolve => {
        exec(__dirname + "/scripts/list_connections.sh", (err, stdout) => {
            if (!err) {
                let result = [];
                ids.forEach(id => {
                    result.push(getConnectionInfo(id, stdout));
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
            getConnectedCertificates(certificates.map(certificate => certificate.id)).then(results => resolve(results.some(x => x.connected)));
        });
    });
}

function checkConnectedGuestCertificates() {
    return new Promise(resolve => {
        Certificate.find({
            username: undefined
        }).then(certificates => {
            getConnectedCertificates(certificates.map(certificate => certificate.id)).then(results => {
                const connectedCertificates = results.filter(x => x.connected).map(x => x.id);
                const expiredGuestCertificates = certificates.filter(certificate => !connectedCertificates.includes(certificate.id) && !guestIds.includes(certificate.id));
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
        }).then(async certificates => {
            for(let certificate in certificates) {
                if (certificate.id) {
                    await deleteCertificateById(certificate.id); 
                }
            }
            resolve();
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
    exec([__dirname + "/scripts/get_certificate.sh", __dirname, id, type, serverDomain].join(" "), (err, stdout) => handleOutput(err, stdout, callback));
}

function executeGetSmbShare(username, smbPassword, callback) {
    exec([__dirname + "/scripts/get_smb_share.sh", __dirname, username, smbPassword].join(" "), (err, stdout) => handleOutput(err, stdout, callback));
}

function executeList(callback) {
    exec(__dirname + "/scripts/list.sh", (err, stdout) => {
        let response = {};
        try {
            response = JSON.parse(stdout)
        } catch {}
        handleOutput(err, response, callback)
    });
}

function executeSearch(callback, search) {
    try {
        exec([__dirname + "/scripts/search.sh", `\"${search}\"`].join(" "), (err, stdout) => {
            let response = [];
            try {
                response = JSON.parse(stdout)
            } catch {}
            handleOutput(err, response, callback)
        });
    } catch {
        callback();
    }
}

function executeAdd(callback, magnet) {
    exec([__dirname + "/scripts/add.sh", `\"${magnet}\"`].join(" "), (err, stdout) => {
        let response = {};
        try {
            response = JSON.parse(stdout)
        } catch {}
        handleOutput(err, response, callback)
    });
}

function executeRemove(callback, id) {
    exec([__dirname + "/scripts/remove.sh", `\"${id}\"`].join(" "), (err, stdout) => {
        let response = {};
        try {
            response = JSON.parse(stdout)
        } catch {}
        handleOutput(err, response, callback)
    });
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

function cleanOutput(value) {
    [].concat(value).forEach(item => REMOVE_PROPERTIES.forEach(property => delete item[property]));
    return value;
}

function createCertificateEndpoint(action, path, fn, isAuthenticated = true) {
    createEndpoint(action, path, (req, res) => {
        res.setHeader("Content-Type", "application/x-openvpn-profile");
        res.setHeader("Content-Disposition", `attachment; filename=${req?.user?.username || `guest`}.ovpn`);
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
                    try {
                        res.end(JSON.stringify(result));
                    } catch {
                        res.end();
                    }
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

createEndpoint("post", "certificates", (req, res) => {
    return new Promise(resolve => {
        let password = req.body.password;
        if (!validatePassword(req.user.passwordHash, password) || !password) {
            res.status(401);
            resolve();
        } else {
            createCertificate(req.user.username, password).then(id => {
                Certificate.findOne({ id }).then(certificate => resolve(certificate));
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

createEndpoint("get", "torrents", () => new Promise(resolve => executeList(resolve)));

createEndpoint("get", "torrents/search/:search", req => new Promise(resolve => executeSearch(resolve, decodeURIComponent(req.params.search))));

createEndpoint("post", "torrents", req => new Promise(resolve => executeAdd(resolve, req.body.magnet)));

createEndpoint("delete", "torrents/:id", req => new Promise(resolve => executeRemove(resolve, req.params.id)));

createEndpoint("get", "devices", () => {
    return new Promise(resolve => {
        Device.find().then(devices => resolve(devices));
    });
});

createEndpoint("post", "devices", req => {
    return new Promise(resolve => {
        let mac = req.body.mac;
        let name = req.body.name;
        Device.findOne({ mac }).then(device => {
            const updatedDevice = {
                mac,
                name
            };
            if(device == null) {
                Device.create(updatedDevice).then(() => resolve(true));
            } else {
                if (name) {
                    Device.update(updatedDevice, { mac }).then(() => resolve(true));
                } else {
                    Device.delete({ mac });
                }
            }
        })
    })
})

createEndpoint("get", "certificates", req => {
    return new Promise(resolve => {
        Certificate.find({
            username: req.user.username
        }).then(certificates => {
            let certificateIds = certificates.map(certificate => certificate.id);
            getConnectedCertificates(certificateIds).then(certificateInfo => {
                resolve(cleanOutput(certificates).map(certificate => ({
                    ...certificate,
                    ...certificateInfo.find(x => x.id === certificate.id)
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

createEndpoint("delete", "certificates", req => {
    return new Promise(resolve => {
        let username = req.user.username;
        User.findOne({
            username
        }).then(user => {
            if (user && req.user.username) {
                deleteCertificates(username).then(() => resolve());
            }
        });
    });
}, true);

createEndpoint("get", "users/current", req => {
    return Promise.resolve(cleanOutput(req.user));
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
    app.all("*", (_, res) => {
        res.status(200).sendFile("/", { root: "./ui" });
    });
}

setInterval(() => checkConnectedGuestCertificates(), GUEST_CHECK_INT);

server.setTimeout(GATEWAY_TIMEOUT);
server.listen(port);
console.log(`Running on Port: ${port}`);