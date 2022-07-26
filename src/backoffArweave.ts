import Arweave from "arweave";
import Api, { ApiConfig } from "arweave/node/lib/api";
import { AxiosInstance } from "axios";
import axiosRetry from "axios-retry";

export default class BackoffArweave extends Arweave {
    constructor(config: ApiConfig) {
        super(config)
        this.api = new BackoffApi(config)
    }
}

class BackoffApi extends Api {
    request(): AxiosInstance {
        const instance = super.request()
        axiosRetry(instance, { retryDelay: axiosRetry.exponentialDelay })
        return instance
    }
}
