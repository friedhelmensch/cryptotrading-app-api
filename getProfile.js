import { getProfile } from './libs/profile-lib';
import { success, failure } from './libs/response-lib';

export async function main(event, context, callback) {
  
  try {
    const profile = await getProfile(event.requestContext.identity.cognitoIdentityId);
    
    if (profile) {
      var returnValue = {
        spread : profile.spread,
        buyFactor : profile.buyFactor,
        targetProfit : profile.targetProfit,
        euroLimit : profile.euroLimit,
        active: profile.active
      }
      callback(null, success(returnValue));

    } else {
      callback(null, success({noProfile : true}));
    }

  }
  catch (e) {
    callback(null, failure({ status: false }));
  }
};