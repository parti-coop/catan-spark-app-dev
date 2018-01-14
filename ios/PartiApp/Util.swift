//
//  Util.swift
//  PartiApp
//
//  Created by shkim on 12/24/17.
//  Copyright © 2017 Slowalk. All rights reserved.
//

import UIKit
import Foundation
import SafariServices

class Util
{
	static func isNilOrEmpty(_ optStr: String?) -> Bool {
		if let str = optStr {
			//return str.trimmingCharacters(in: .whitespaces).isEmpty
			return str.isEmpty
		} else {
			return true
		}
	}
	
	static func getLocalizedString(_ key: String) -> String {
		return Bundle.main.localizedString(forKey:key, value:"", table:nil)
	}
	
	static func showSimpleAlert(_ message: String) {
		let alertController = UIAlertController(title: nil, message:message, preferredStyle:.alert)
		alertController.addAction(UIAlertAction(title: getLocalizedString("ok"), style:.`default`))
		ViewController.instance.present(alertController, animated:true, completion:nil)
	}

	static func getMD5Hash(_ string: String) -> String {
		let context = UnsafeMutablePointer<CC_MD5_CTX>.allocate(capacity: 1)
		var digest = Array<UInt8>(repeating:0, count:Int(CC_MD5_DIGEST_LENGTH))
		CC_MD5_Init(context)
		CC_MD5_Update(context, string, CC_LONG(string.lengthOfBytes(using: String.Encoding.utf8)))
		CC_MD5_Final(&digest, context)
		context.deallocate(capacity: 1)

		var hexString = ""
		for byte in digest {
			hexString += String(format:"%02x", byte)
		}
		return hexString
	}
	
	
	
	// From https://github.com/firebase/firebase-ios-sdk/blob/master/Example/Shared/FIRSampleAppUtilities.m
	
	static func appContainsRealServiceInfoPlist() -> Bool {
		return containsRealServiceInfoPlistInBundle(Bundle.main)
	}

	static let kServiceInfoFileName = "GoogleService-Info"
	static let kServiceInfoFileType = "plist"
	static let kGoogleAppIDPlistKey = "GOOGLE_APP_ID"
	static let kDummyGoogleAppID = "1:123:ios:123abc"
	
	static func containsRealServiceInfoPlistInBundle(_ bundle: Bundle) -> Bool {
		let bundlePath = bundle.bundlePath
		if bundlePath.isEmpty {
			return false;
		}

  		let plistFilePath = bundle.path(forResource: kServiceInfoFileName, ofType: kServiceInfoFileType)
		if Util.isNilOrEmpty(plistFilePath) {
			return false;
		}
		
		let plist_ = NSDictionary(contentsOfFile: plistFilePath!)
		guard let plist = plist_ else {
			return false
		}

		// Perform a very naive validation by checking to see if the plist has the dummy google app id
		let googleAppID = plist[kGoogleAppIDPlistKey] as! String?;
		if Util.isNilOrEmpty(googleAppID) {
			return false
		}

		if googleAppID == kDummyGoogleAppID {
			return false
		}

		return true
	}
	
	static let kGithubRepoURLString = "https://github.com/firebase/firebase-ios-sdk/"
	static let kInvalidPlistAlertTitle = "GoogleService-Info.plist"
	
	static func presentAlertForInvalidServiceInfoPlistFrom(_ viewController: UIViewController) {
		let message = """
This sample app needs to be updated with a valid GoogleService-Info.plist file in order to configure Firebase.

Please update the app with a valid plist file, following the instructions in the Firebase Github repository at: \(kGithubRepoURLString)
"""
		
		let alertController = UIAlertController(title: kInvalidPlistAlertTitle, message:message, preferredStyle:.alert)
		
		let viewReadmeAction = UIAlertAction(title: "View Github", style:.`default`, handler: { _ in
			let githubURL = URL(string: kGithubRepoURLString)!;
			Util.navigate(toURL:githubURL, fromViewController:viewController);
		})
		alertController.addAction(viewReadmeAction)

		let cancelAction = UIAlertAction(title:"Close", style:.cancel)//, handler:nil);
		alertController.addAction(cancelAction)
		
		viewController.present(alertController, animated:true, completion:nil)
	}

	static func navigate(toURL url: URL, fromViewController viewController: UIViewController) {
		if #available(iOS 9.0, *) {
			let svc = SFSafariViewController(url: url)
			//viewController.presentViewController(svc, animated: true, completion: nil)
			viewController.showDetailViewController(svc, sender: nil)
		} else {
			UIApplication.shared.openURL(url)
		}
	}
}
