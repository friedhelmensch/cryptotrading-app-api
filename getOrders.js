import { getProfile } from './libs/profile-lib';
import { success, failure } from './libs/response-lib';
import KrakenClient from './libs/kraken-lib';

export async function main(event, context, callback) {

    try {
        var profile = getProfile(event.requestContext.identity.cognitoIdentityId);
        if (!profile) callback(null, success({}));
    
        
        var kraken = new KrakenClient(profile.apiKey, profile.apiSecret);

        var closedOrdersResult = await kraken.api("ClosedOrders");
        var closedOrders = closedOrdersResult.result.closed;

        var returnOrders = [];

        for (var key in closedOrders) {
            var closedOrder = closedOrders[key];
            console.log(closedOrder);
            var returnOrder = {
                status : closedOrder.status,
                cost: closedOrder.cost,
                opentime: closedOrder.opentm,
                pair: closedOrder.descr.pair,
                type: closedOrder.descr.type,
                summary: closedOrder.descr.order
            }
            returnOrders.push(returnOrder);
        }
        console.log(returnOrders.length);
        callback(null, success(returnOrders));
    }
    catch (e) {
        callback(null, failure({ status: false }));
    }
};
