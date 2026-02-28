const { FirebaseDB } = require('multi-db-orm')

class Service {

    db
    host
    payServiceAccessToken
    payserviceUrl
    payserviceWebhookSecret
    constructor(admin, host, payServiceAccessToken, payserviceUrl, payserviceWebhookSecret) {
        this.db = new FirebaseDB(undefined, 'payments', admin)
        this.host = host
        this.payServiceAccessToken = payServiceAccessToken
        this.payserviceUrl = payserviceUrl
        this.payserviceWebhookSecret = payserviceWebhookSecret
    }

    getPacks() {
        // read from TABLE_PACKAGES

    }

    createPaymentLink(email, name, packId, credits, stateObj) {
        /**
         * curl --location 'payserviceUrl/pay/api/createTxn' \
            --header 'Content-Type: application/json' \
            --header 'Authorization: Bearer payServiceAccessToken' \
            --header 'Cookie: access_token=payServiceAccessToken' \
            --data-raw '{
                "NAME":"Shivesh",
                "CLIENT_ID":"bhashya-ai-prod",
                "EMAIL":email,
                "TXN_AMOUNT": 10.0, // determine based on credits and pack price
                "PRODUCT_NAME":"<pack_id>_<pack_credits>",
                "RETURN_URL":"host/?state=base64(JSON.stringify(stateObj))",
                "WEBHOOK_URL":"host/webhook/add-credits/{payserviceWebhookSecret}",
                "STATE": JSON.stringify(stateObj) // e.g. '{"packId":"pack_123","credits":10
            }'
         */

        // if packid is provided, use that to determine credits and amount. If credits is provided directly, react the pack with 1 credits and multiply the amount accordingly.

    }

    getCredits(email) {

    }


    /**
     * Recieves @Payment document in the param, validates it, and adds credits to the user's account accordingly. If the lastPaymentId in the user's credits document matches the incoming payment id, it should not add credits again to prevent duplicates.
     */
    addCredits(email, credits, paymentObj) {

    }


    deductCredits(email, credits, generationId) {


    }


    canGenerate(email, generationInput) {

        const maxFreeGenerationsPerUser = 10;
        // allow generation if user has enough credits or if it's a free generation i.e. duration <=1, resolution is 360p, graphics_quality is low, speech_quality is low-ai, and user has not exceeded free generation limit

    }

    calculateRequiredCredits(generationInput) {
        // calculate required credits based on generation input parameters like duration, resolution, graphics_quality, speech_quality etc.
    }


    getGenerations(email) {
        // get all generations for the user, excluding soft-deleted ones

    }

    deleteGeneration(email, generationId) {
        // soft delete by setting deletedAt timestamp

    }




}


/**
 * {id, label, amount, credits, currency}
 */
const TABLE_PACKAGES = 'packages'

/**
 * {email, id, credits, createdAt, updatedAt, lastPaymentId}
 */
const TABLE_CREDITS = 'credits'

/**
 * 
 * 
 * GenerationInput
 *         
         inputs {
                prompt: string
                token: string | 'free'
                orientation: 'landscape' | 'portrait'
                theme: 'general' | 'hindu' | 'educational'
                duration: number | 1 | 2 // in minutes
                language: 'hindi' | 'english'
                speech_quality: 'neural' | 'low-ai' | 'high-ai'
                graphics_quality: 'high' | 'low'
                resolution: '360p' | 'SD' | 'HD'
                delivery_email: string
                video_type?: 'avatar' | 'slideshow'
            }
  

 * Generation document schema
 * 
 * {
 *   id: string,                    // e.g. "daily-gen-video-general-1772293253295"
 *   name: string,                  // e.g. "daily-gen-video-general"
 *   email: string,                 // user email
 *   
 *   status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED",
 *   isRunning: boolean,
 *   
 *   currentTaskIdx: number,        // current task index (0-based)
 *   tasks: Task[],                 // queued tasks
 *   executedTasks: Task[],         // completed tasks
 *   
 *   startTime: string,             // epoch ms (string)
 *   endTime: string,               // epoch ms (string)
 *   
 *   output: {
 *     url: string,                 // final video URL
 *     caption: string,             // full caption
 *     caption_small: string        // short caption
 *   },
 *   
 *   raw: GenerationInput,              // raw generation input for reference
 *   
 *   createdAt?: string,
 *   updatedAt?: string
 * }
 */
const TABLE_GENERATIONS = 'generations'



/**
 * Payment document schema
 * {
    "id": "order_SLTBRa1FoMDCQN",
    "orderId": "order_SLTBRa1FoMDCQN",
    "cusId": "user_SGnPOmzPxi",
    "time": 1772260742971,
    "name": "Shivesh",
    "email": "shivesahnavin@gmail.com",
    "phone": null,
    "amount": 10,
    "pname": "TEST",
    "returnUrl": "host/?state=base64(JSON.stringify(stateObj))",
    "webhookUrl": "host/webhook/add-credits/{payserviceWebhookSecret}",
    "clientId": "finalflagger-prod",
    "extra": "{\"razorpay_payment_id\":\"pay_SLTCDJgD6t3ygo\",\"razorpay_order_id\":\"order_SLTBRa1FoMDCQN\",\"razorpay_signature\":\"f24b7be21c7cd7cfa129c664a8508e1f5dc1ceabb79ea6673997db3f72bd041e\",\"ORDERID\":\"order_SLTBRa1FoMDCQN\",\"extras\":{\"amount\":1000,\"amount_due\":0,\"amount_paid\":1000,\"attempts\":1,\"created_at\":1772260742,\"currency\":\"INR\",\"entity\":\"order\",\"id\":\"order_SLTBRa1FoMDCQN\",\"notes\":[],\"offer_id\":null,\"receipt\":\"user_SGnPOmzPxi_1772260733988\",\"status\":\"paid\"},\"STATUS\":\"TXN_SUCCESS\",\"TXNID\":\"pay_SLTCDJgD6t3ygo\"}",
    "status": "TXN_SUCCESS",
    "txnId": "pay_SLTCDJgD6t3ygo"
}
 */


module.exports = { Service }