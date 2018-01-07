var express = require('express');
var router = express.Router();

var FCM = require('fcm-node');
var debug = require('debug')('app');
var dbm = require("../dbm");

const SESSION_KEY = "session";
const PARTI_TOPPAGE_URI = "/";
const FCM_ServerKey = "AAAAsXNrA-E:APA91bH9KzxvcI6ywmXfGuWxCIL3rMM49Qn9vfPDxDMrTpEd1o4n0K-Z7yRXcPwJFJ090wYhMpMxyce1nkkN9jxnx7fI69KeVHuZbXiqbY8AUPOH5I4d_oG9F77-OjRvGfd6aiIW8Izb";

let fcm = new FCM(FCM_ServerKey);

router.get('/register', function(req, res, next) {
	res.render('register_form');
});

router.post('/register', async function(req, res, next) {
	let userid = req.body["userid"];
	let passwd = req.body["passwd"];

	try {
		const result = await dbm.registerUser(userid, passwd);
		debug("registerUser(%s,%s): %s", userid, passwd, result);
		res.render('register_result', {
			"userid":result[0].loginId
		});
	} catch(err) {
		next(err);
	}
});

router.get('/login', function(req, res, next) {
	res.render('login_form');
});

router.post('/login', async function(req, res, next) {
	let userid = req.body["userid"];
	let passwd = req.body["passwd"];

	try {
		const sesskey = await dbm.loginUser(userid, passwd);
		debug("loginUser(%s,%s): %s", userid, passwd, sesskey);
		res.cookie(SESSION_KEY, sesskey, { maxAge: 900000 });
		debug("setCookie: %s=%s", SESSION_KEY, sesskey);
		res.render('login_result', {
			"userid":userid,
			"sesskey":sesskey
		});
	} catch(err) {
		next(err);
	}
});

router.get('/logout', async function(req, res, next) {
	let sesskey = req.cookies[SESSION_KEY];
	let msg;
	if (sesskey) {
		try {
			res.clearCookie(SESSION_KEY);

			// DB에서 로그아웃 시키면 세션키로 registrationId 삭제하는 API 에서 실패해서 그냥 놔둡니다.
			//let info = await dbm.getUserFromSesskey(sesskey);
			//debug("getUserFromSesskey(%s): %o", sesskey, info);
			//let lor = await dbm.logoutUser(info.loginId);
			//debug("logoutUser(%s): %s", info.loginId, lor);

			msg = "성공적으로 로그아웃 하였습니다.";
		} catch(err) {
			return next(err);
		}
	} else {
		msg = "쿠키 세션키가 없습니다. (로그인 상태가 맞나요?)";
		debug("/logout: no sesion cookie found.");
	}

	res.render('logout_result', { "msg":msg });
});


router.get('/sendpush', async function(req, res, next) {
	try {
		let tokens = await dbm.getAllDevices();
		res.render('sendpush_form', {
			"tokens": tokens
		});
	} catch(err) {
		return next(err);
	}
});

router.post('/sendpush', function(req, res, next) {
	let to = req.body["to"];
	let title = req.body["title"];
	let body = req.body["body"];
	let url = req.body["url"];
	debug("sendpush: to=%s, title=%s, body=%s, url=%s", to, title, body, url);

	if (!to) {
		return next(new Error("수신 대상자를 선택해주세요."));
	}

	if (!title && !body && !url) {
		return next(new Error("전송할 내용이 없습니다."));
	}

	let message = {
		"to": to,
		"collapse_key": 'ignore_this',

		// notification 의 title,body 는 시스템 노티 영역에 출력될 메세지이고,
        // 아래 data 의 title,body 는 앱으로 진입 후 표시할 내용입니다.
        // (백그라운드에 있다가 앱으로 진입 후 notification 에 있는 값을 읽을 수가 없어서 두번 줘야 함.)

 		// notification 과 data 에 title,body를 설정하고 있는데,
		// 아래처럼 기술적으로 다른 값을 줄 수는 있지만, 같은 값을 주세요.
		
		notification: {
            "title": title,
            "body": body,
			"sound": "default"      // 이거 빼면 소리 안나게 할 수 있음
		},
		
		// title 과 body 둘다 없으면 내용 출력 alert 없이 바로 url 로 갈 수 있습니다.
		// 그러나 앱이 포그라운드일때는 notification 내용이 출력 후 url 로 갑니다.
		data: {
            "title": title,
            "body": body,
            "url": url
        }
	}

	fcm.send(message, function(err, response) {
		if (err) {
			return next(err);
		}
		
		res.send("푸시 메세지를 전송하였습니다.: " + response);
	});
});

async function getMainPage(req, res, next) {
	let loginUserId;
	let sesskey = req.cookies[SESSION_KEY];	
	if (sesskey) {
		try {
			let info = await dbm.getUserFromSesskey(sesskey);
			loginUserId = info.loginId;
		} catch(err) {			
			;
		}
	}

	res.render('index', {
		"time": new Date().toString(),
		"loginUser": loginUserId
	});
}

async function getAppstartPage(req, res, next) {
	let isLogin;
	let sesskey = req.cookies[SESSION_KEY];	
	if (sesskey) {
		try {
			let info = await dbm.getUserFromSesskey(sesskey);
			isLogin = info.loginId;
		} catch(err) {			
			;
		}
	}

	res.render('start_app', {
		"isLogin": isLogin,
		"url": PARTI_TOPPAGE_URI
	});
}

// 앱으로부터 세션 복구 요청
router.post('/restore', async function(req, res, next) {
	let sesskey = req.body["auth"];
	if (sesskey) {
		try {
			let info = await dbm.getUserFromSesskey(sesskey);
			debug("restore: getUserFromSesskey succeeded");

			// 세션키가 올바르다. 쿠키를 셋팅하고 초기 페이지로 보낸다.
			res.cookie(SESSION_KEY, sesskey, { maxAge: 900000 });
			res.redirect(PARTI_TOPPAGE_URI);
			return;
		} catch(err) {
			;
		}
	}

	// sesskey값이 비었거나 올바르지 않거나...
	debug("/restore: session restore failed. make app logout then goto top page.");
	// 위와 같이 초기페이지로 바로 이동하지 않고 앱이 저장된 인증정보를 지우도록 js를 호출하는 HTML을 출력한다.
	res.clearCookie(SESSION_KEY);	// 쿠키도 지우고
	res.render("start_anonymous", {
		"url": PARTI_TOPPAGE_URI
	})
});

module.exports = { 
	"routes": router,
	"mainPageHandler": getMainPage,
	"appstartPageHandler": getAppstartPage,
};
