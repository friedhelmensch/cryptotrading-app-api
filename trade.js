import { trade } from './libs/trading-lib';
import { success, failure } from './libs/response-lib';

var lastReqId;

export async function main(event, context, callback) {

    // We check if the lambda is being retried.
    // If that's the case, we kill it
    // We leverage lambda's quirks:
    // - lambda's node process reuse which keeps vars instanced
    // - retried lambdas have the same request id 
    // Hopefully Amazon will someday allow us to disable autoretries
    // https://forums.aws.amazon.com/thread.jspa?threadID=176074
    if (lastReqId == context.awsRequestId) {
        console.log('Lambda auto retry detected. Aborting.');
        callback(null, success(true));
        return context.succeed();
    } else {
        lastReqId = context.awsRequestId;
    };

    const signal = 5; //percentage
    const factor = 1.6; //arbitrary factor
    const euroLimit = 0; //Euro
    const targetProfit = 3; // percentage;
    const expirationHours = 0.5;

    try{
        await trade(getCandle, signal, factor, euroLimit, targetProfit, expirationHours);
        callback(null, success(true));
    }
    catch(e)
    {
        console.error("trading went wrong: " + e);
        callback(null, failure({ status: false }));
    }
};

async function getCandle(kraken, pair){

    var now = Date.now();
    var fourHourAgo = 4 * 60 * 60 * 1000;
    var startTime = (now - fourHourAgo) / 1000;
    
    var ohlcResponse = await kraken.api('OHLC', { pair: pair, interval: 240, since: startTime });
    
    if (ohlcResponse.result[pair].length > 1) {
        console.error(ohlcResponse.result[pair].length + " candles for : " + pair);
        return;
    }
    var candle = convertResponseToCandle(ohlcResponse, pair);

    return candle;
}

function convertResponseToCandle(response, pair)
{
    var result = response.result[pair][0];
    var high = result[2] * 1;
    var low = result[3] * 1;
    var close = result[4] * 1;
    // * 1 to convert string to number
    return {high: high, low : low, close: close, pair : pair }
}