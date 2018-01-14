//
//  AppDelegate.swift
//  PartiApp
//
//  Created by shkim on 12/22/17.
//  Copyright © 2017 Slowalk. All rights reserved.
//

import UIKit
import FirebaseCore
import FirebaseMessaging
import UserNotifications
import Fabric
import Crashlytics

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

	var window: UIWindow?
	
	private var httpMan: HttpMan = HttpMan()
	private var apiMan: ApiMan = ApiMan()

	static func getHttpManager() -> HttpMan {
		return (UIApplication.shared.delegate as! AppDelegate).httpMan
	}
	
	static func getApiManager() -> ApiMan {
		return (UIApplication.shared.delegate as! AppDelegate).apiMan
	}

	static let isWithinUnitTest: Bool = {
		if let testClass = NSClassFromString("XCTestCase") {
			return true
		} else {
			return false
		}
	}()
	
	static var hasPresentedInvalidServiceInfoPlistAlert = false

	func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplicationLaunchOptionsKey: Any]?) -> Bool {
		Fabric.with([Crashlytics.self])
		
		guard !AppDelegate.isWithinUnitTest else {
			// During unit tests, we don't want to initialize Firebase, since by default we want to able
			// to run unit tests without requiring a non-dummy GoogleService-Info.plist file
			return true
		}

		guard Util.appContainsRealServiceInfoPlist() else {
			// We can't run because the GoogleService-Info.plist file is likely the dummy file which needs
			// to be replaced with a real one, or somehow the file has been removed from the app bundle.
			// See: https://github.com/firebase/firebase-ios-sdk/
			// We'll present a friendly alert when the app becomes active.
			return true
		}

		FirebaseApp.configure()

		Messaging.messaging().delegate = self
		Messaging.messaging().shouldEstablishDirectChannel = true
		// Just for logging to the console when we establish/tear down our socket connection.
		listenForDirectChannelStateChanges();

		NotificationsController.configure()

		if #available(iOS 8.0, *) {
			// Always register for remote notifications. This will not show a prompt to the user, as by
			// default it will provision silent notifications. We can use UNUserNotificationCenter to
			// request authorization for user-facing notifications.
			application.registerForRemoteNotifications()
		} else {
			// iOS 7 didn't differentiate between user-facing and other notifications, so we should just
			// register for remote notifications
			NotificationsController.shared.registerForUserFacingNotificationsFor(application)
		}
		
		// Override point for customization after application launch.
		return true
	}
	
	func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
		print("APNS Token: \(deviceToken.hexByteString)")
		NotificationCenter.default.post(name: APNSTokenReceivedNotification, object: nil)
		if #available(iOS 8.0, *) {
		} else {
			// On iOS 7, receiving a device token also means our user notifications were granted, so fire
			// the notification to update our user notifications UI
			NotificationCenter.default.post(name: UserNotificationsChangedNotification, object: nil)
		}
	}

	func application(_ application: UIApplication,
		didRegister notificationSettings: UIUserNotificationSettings) {
		NotificationCenter.default.post(name: UserNotificationsChangedNotification, object: nil)
	}

	func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable : Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
		print("application:didReceiveRemoteNotification:fetchCompletionHandler: called, with notification:")
		print("\(userInfo.jsonString ?? "{}")")
		completionHandler(.newData)
	}


	func applicationWillResignActive(_ application: UIApplication) {
		// Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
		// Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
	}

	func applicationDidEnterBackground(_ application: UIApplication) {
		// Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
		// If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
	}

	func applicationWillEnterForeground(_ application: UIApplication) {
		// Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
	}

	func applicationDidBecomeActive(_ application: UIApplication) {
		// Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
		
		// If the app didn't start property due to an invalid GoogleService-Info.plist file, show an alert to the developer.
		if !Util.appContainsRealServiceInfoPlist() && !AppDelegate.hasPresentedInvalidServiceInfoPlistAlert {
			if let vc = window?.rootViewController {
				Util.presentAlertForInvalidServiceInfoPlistFrom(vc)
				AppDelegate.hasPresentedInvalidServiceInfoPlistAlert = true
			}
		}
	}

	func applicationWillTerminate(_ application: UIApplication) {
		// Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
	}

	func application(_ application: UIApplication, handleEventsForBackgroundURLSession identifier: String, completionHandler: @escaping () -> Void) {
		debugPrint("handleEventsForBackgroundURLSession: \(identifier)")
		completionHandler()
    }



}

extension AppDelegate: MessagingDelegate {
	// FCM tokens are always provided here. It is called generally during app start, but may be called
	// more than once, if the token is invalidated or updated. This is the right spot to upload this
	// token to your application server, or to subscribe to any topics.
	func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String) {
		if let token = Messaging.messaging().fcmToken {
			print("FCM Token: \(token)")
		} else {
			print("FCM Token: nil")
		}
	}

	// Direct channel data messages are delivered here, on iOS 10.0+.
	// The `shouldEstablishDirectChannel` property should be be set to |true| before data messages can
	// arrive.
	func messaging(_ messaging: Messaging, didReceive remoteMessage: MessagingRemoteMessage) {
		// Convert to pretty-print JSON
		guard let prettyPrinted = remoteMessage.appData.jsonString else {
			print("Received direct channel message, but could not parse as JSON: \(remoteMessage.appData)")
			return
		}
		print("Received direct channel message:\n\(prettyPrinted)")
	}
}

extension AppDelegate {
	func listenForDirectChannelStateChanges() {
		NotificationCenter.default.addObserver(self, selector: #selector(onMessagingDirectChannelStateChanged(_:)), name: .MessagingConnectionStateChanged, object: nil)
	}

	@objc func onMessagingDirectChannelStateChanged(_ notification: Notification) {
		print("FCM Direct Channel Established: \(Messaging.messaging().isDirectChannelEstablished)")
	}
}

extension Dictionary {
	/// Utility method for printing Dictionaries as pretty-printed JSON.
	var jsonString: String? {
		if let jsonData = try? JSONSerialization.data(withJSONObject: self, options: [.prettyPrinted]),
			let jsonString = String(data: jsonData, encoding: .utf8) {
			return jsonString
		}
		return nil
	}
}

extension Data {
	// Print Data as a string of bytes in hex, such as the common representation of APNs device tokens
	// See: http://stackoverflow.com/a/40031342/9849
	var hexByteString: String {
		return self.map { String(format: "%02.2hhx", $0) }.joined()
	}
}
