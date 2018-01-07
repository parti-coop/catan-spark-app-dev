var expect = require("chai").expect;
var assert = require('chai').assert;
var fs = require("fs");
var path = require("path");

var dbm = require("../dbm");
const TESTDB_DIR = "_testdb";

function removeFileIfAny(filename) {
    if (fs.existsSync(filename)) {
        fs.unlinkSync(filename);
    }
}

function isError(e) {
    if (typeof e === 'string') {
        return Promise.reject(new Error(e));
    }
    return Promise.resolve(e);
}

function shouldFail(prom) {
    prom.then(() => {
            return Promise.reject('Expected method to reject.');
        })
        .catch(isError)
        .then((err) => {
            assert.isDefined(err);
        });
}

describe("dbm.js", function(){
    
    before(async function() {
        // delete old db files
        removeFileIfAny(path.join(TESTDB_DIR, "user"));
        removeFileIfAny(path.join(TESTDB_DIR, "token"));

        await dbm.open(TESTDB_DIR);
    });

    after(function() {
        dbm.close();
    });

    it("Should create a new user", async () => {
        const result = await dbm.registerUser("test1","pswd1");
        assert.lengthOf(result, 1);
        assert.equal(result[0].loginId, "test1");
        assert.equal(result[0].passwd, "pswd1");
    });

    it("Should not create the same-loginId user", () => {
        shouldFail(dbm.registerUser("test1","pswd1"));
    });

    it("Should succeed in login with id/pw", async () => {
        await dbm.loginUser("test1", "pswd1");
    });

    it("Should not succeed in login with wrong id/pw", () => {
        shouldFail(dbm.loginUser("test2", "pswd1"));
    });

    it("Should not succeed in login with id/wrong pw", () => {
        shouldFail(dbm.loginUser("test1", "pswd2"));
    });

    it("Should succeed in logout user", async () => {
        await dbm.logoutUser("test1");
    });

    it("Should not succeed in logout wrong user", () => {
        shouldFail(dbm.logoutUser("test2"));
    });

    it("Should succeed in getting user from sesskey", async () => {
        let sesskey = await dbm.loginUser("test1", "pswd1");
        let user = await dbm.getUserFromSesskey(sesskey);
    });

    it("Should fail in getting user from logged-out sesskey", async () => {
        let sesskey = await dbm.loginUser("test1", "pswd1");
        await dbm.logoutUser("test1");
        shouldFail(dbm.getUserFromSesskey(sesskey));
    });

    it("Should register the device token", async () => {
        let r1 = await dbm.registerToken("test1", "regToken1", "appId1");
        assert.equal(r1, 1);
        let r2 = await dbm.registerToken("test1", "regToken1", "appId1");
        assert.equal(r2, 1);    // silently ignore duplication
        let r3 = await dbm.registerToken("test1", "regToken2", "appId2");
        assert.equal(r3, 1);
        
        let arr = await dbm.getUserDevices("test1");
        expect(arr).to.deep.include({ regId:"regToken1", appId:"appId1" });
        expect(arr).to.deep.include({ regId:"regToken2", appId:"appId2" });
        
        // silently update the uplicated item
        let r4 = await dbm.registerToken("test1", "regToken1", "appId3");
        assert.equal(r4, 1);
        let arr2 = await dbm.getUserDevices("test1");
        expect(arr2).to.deep.include({ regId:"regToken1", appId:"appId3" });        
    });

    it("Should remove the device token", async () => {
        let r1 = await dbm.removeToken("regToken1");
        assert.equal(r1, 1);
        let r2 = await dbm.removeToken("regToken1");
        assert.equal(r2, 0);

        let arr = await dbm.getUserDevices("test1");
        expect(arr).to.have.lengthOf(1);
        expect(arr).to.deep.include({ regId:"regToken2", appId:"appId2" });
    });

});
