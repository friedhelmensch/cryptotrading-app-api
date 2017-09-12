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

    const signal = 6; //percentage
    const factor = 1.7; //arbitrary factor
    const euroLimit = 0; //Euro
    const targetProfit = 7; // percentage;
    const expirationHours = 3.5;

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

async function getCandle(kraken, pair)
{
    var response = await kraken.api('Ticker', { pair: pair });
    const result = response.result[pair];
    // * 1 to convert string to number
    const high = result['h'][1] * 1;
    const low = result['l'][1] * 1;
    const close = result['c'][0] * 1;
    
    return {high: high, low : low, close: close, pair : pair }
}