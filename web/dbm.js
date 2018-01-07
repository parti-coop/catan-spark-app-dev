let fs = require('fs');
let tingo = require('tingodb')();
var crypto = require('crypto');

let db;
let coll_users;
let coll_tokens;

function _getSha256Hash(raw) {
    return crypto.createHash('sha256').update(raw).digest('base64');
}

function getCollection(name) {
    if (!db) {
        throw new Error("getCollection: db is not ready");
    }

    return db.collection(name);
}

function open(dbpath) {
    if (!fs.existsSync(dbpath)){        
        fs.mkdirSync(dbpath);
        console.log("Database directory created: " + dbpath);
    }

    db = new tingo.Db(dbpath, {});

    return new Promise(function(resolve,reject) {
        coll_users = getCollection("user");
        coll_tokens = getCollection("token");

        coll_users.ensureIndex({"loginId":1},{unique:true}, function(err) {
            if (err) {
                reject(err);
            } else {
                coll_tokens.ensureIndex({"regId":1},{unique:true}, function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            }
        });
    });
}

function close() {
    db.close();
    db = null;
}


function registerUser(loginId, passwd) {
    if (!loginId || !passwd) {
        throw new Error("Required field missing for registerUser");
    }

    let doc = {
        "loginId": loginId,
        "passwd": passwd    // save as plain text, but it's okay since this is a demo.
    };

    return new Promise(function(resolve,reject) {
        coll_users.insert(doc, {w:1}, function(err, result) {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });    
}

function loginUser(loginId, passwd) {
    if (!loginId || !passwd) {
        throw new Error("Required field missing for loginUser");
    }

    let where = { "loginId": loginId };
    return new Promise(function(resolve,reject) {
        coll_users.findOne(where, {"passwd":1}, function(err, item) {
            if (err) {
                reject(err);
            } else if (item == null) {
                reject(new Error("User not found"));
            } else {
                if (item.passwd == passwd) {
                    // login check passed. update session key
                    let sesskey = _getSha256Hash(loginId + (new Date().toString()));
                    coll_users.update(where, {"$set":{"sesskey":sesskey}}, function(err, res) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(sesskey);
                        }
                    });
                } else {
                    // wrong passwd
                    reject(new Error("Wrong password"));
                }
            }
        });
    });
}

function logoutUser(loginId) {
    let where = { "loginId": loginId };    
    return new Promise(function(resolve,reject) {
        coll_users.update(where, {"$unset":{"sesskey":1}}, function(err,res) {
            if (err) {
                reject(err);
            } else if (res) {
                resolve(res);
            } else {
                reject(new Error("Logout update failed"));
            }
        });
    });
}

function getUserFromSesskey(sesskey) {
    let where = { "sesskey": sesskey };
    return new Promise(function(resolve,reject) {
        coll_users.findOne(where, {"loginId":1, "pushToken":1}, function(err, item) {
            if (err) {
                reject(err);
            } else if (item) {
                resolve(item);
            } else {
                reject(new Error("User not found by sesskey"));
            }
        });
    });
}


function registerToken(loginId, regId, appId) {
    if (!loginId || !regId || !appId) {
        throw new Error("Required field missing for registerToken");
    }

    let doc = {
        "loginId": loginId,
        "regId": regId,
        "appId": appId
    };

    return new Promise(function(resolve,reject) {
        coll_tokens.update({"regId":regId}, doc, {"upsert":true}, function(err, result) {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

function removeToken(regId) {
    if (!regId) {
        throw new Error("Required field missing for removeToken");
    }

    return new Promise(function(resolve,reject) {
        coll_tokens.remove({"regId":regId}, function(err, result) {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

function getUserDevices(loginId) {
    if (!loginId) {
        throw new Error("Required field missing for getUserDevices");
    }

    const filter = { "_id":0, "regId":1, "appId":1 };
    return new Promise(function(resolve,reject) {
        coll_tokens.find({"loginId":loginId}, filter).toArray(function(err, items) {
            if (err) {
                reject(err);
            } else {
                resolve(items);
            }
        });
    });
}

function getAllDevices() {
    return new Promise(function(resolve,reject) {
        coll_tokens.find({}).toArray(function(err, items) {
            if (err) {
                reject(err);
            } else {
                resolve(items);
            }
        });
    });
}

module.exports = {
    open, close,
    getCollection,

    registerUser,
    loginUser, logoutUser,
    getUserFromSesskey,

    registerToken, removeToken,
    getUserDevices, getAllDevices
};
