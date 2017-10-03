import * as dynamoDbLib from './dynamodb-lib';

export async function getProfile(userId)
{
    const params = {
        TableName: 'profiles',
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: {
            ":userId": userId,
        }
    };
    const result = await dynamoDbLib.call('query', params);
    const profile = result.Items[0];
    return profile;
}

/*
export function decryptProfile(profile)
{
    const decryptedApiKey = encryptor.decrypt(profile.apiKey, "utf8");
    const decryptedApiSecret = encryptor.decrypt(profile.apiSecret, "utf8");
    const active = profile.active;

    return {
        apiKey : decryptedApiKey,
        apiSecret : decryptedApiSecret,
        active : active
    }
}*/