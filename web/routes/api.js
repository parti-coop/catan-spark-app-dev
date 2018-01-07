var express = require('express');
var router = express.Router();

var debug = require('debug')('app');
var dbm = require("../dbm");


const reAuthToken = /^Bearer (.*?)$/;
function getAuthToken(authstr) {
    let m = reAuthToken.exec(authstr);
    return (m ? m[1] : null);
}

router.post('/v1/device_tokens', async function(req, res, next) {
    let authorization = getAuthToken(req.headers["authorization"]);
    let registrationId = req.body["registration_id"];
    let applicationId = req.body["application_id"];
    
    try {
        let user = await dbm.getUserFromSesskey(authorization);
        debug("POST device_tokens: user=%s, regId=%s, appId=%s", user.loginId, registrationId, applicationId);
        await dbm.registerToken(user.loginId, registrationId, applicationId);

        res.send("OK");
    } catch(err) {
        debug("API registerToken fail:", err);
        res.status(500).send(err.toString());
    }
});

router.delete('/v1/device_tokens', async function(req, res, next) {
    let authorization = getAuthToken(req.headers["authorization"]);
    let registrationId = req.body["registration_id"];
    
    try {
        let user = await dbm.getUserFromSesskey(authorization);
        debug("DELETE device_tokens: user=%s, regId=%s", user.loginId, registrationId);
        await dbm.removeToken(registrationId);

        res.status(204).send("");
    } catch(err) {
        debug("API deleteToken fail:", err);
        res.status(500).send(err.toString());
    }
});

module.exports = router;
