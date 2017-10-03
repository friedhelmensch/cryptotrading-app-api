import { getProfile } from './libs/profile-lib';
import { success, failure } from './libs/response-lib';

export async function main(event, context, callback) {
  
  try {
    const profile = await getProfile(event.requestContext.identity.cognitoIdentityId);
    console.log(profile);
    if (profile) {
      var apiKey = null;
      var apiSecret = null;
      if (profile.apiKey && profile.apiSecret) {
        apiKey = "***encrypted***";
        apiSecret = "***encrypted***";
      }
      else {
        apiKey = "invalid";
        apiSecret = "invalid";
      }

      var returnValue = {
        apiKey: apiKey,
        apiSecret: apiSecret,
        active: profile.active
      }
      callback(null, success(returnValue));

    } else {
      callback(null, success({}));
    }

  }
  catch (e) {
    callback(null, failure({ status: false }));
  }
};