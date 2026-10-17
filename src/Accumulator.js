export class Accumulator {
    constructor(delay, onEnd) {
        this._delay = delay;
        this._onEnd = onEnd;
        this._items = [];
        this._timeoutId = null;
        this._isProcessing = false;
        this._processingPromise = Promise.resolve();
    }

    async addItem(item, { immediate = false } = {}) {
        this._items.push(item);

        // If we're currently processing items, queue them for the next batch
        if (this._isProcessing) return;

        // Reset timeout if it exists
        if (this._timeoutId) {
            clearTimeout(this._timeoutId);
        }

        // Set new timeout or process immediately
        if (this._delay && !immediate) {
            this._timeoutId = setTimeout(() => this._process(), this._delay);
        } else {
            await this._process();
        }
    }

    async _process() {
        if (this._items.length === 0) return;
        
        this._isProcessing = true;
        this._timeoutId = null;
        
        const itemsToProcess = [...this._items];
        this._items = [];
        
        try {
            await this._onEnd(itemsToProcess);
        } finally {
            this._isProcessing = false;
            
            // If new items accumulated during processing, process them
            if (this._items.length > 0) {
                if (this._delay) {
                    this._timeoutId = setTimeout(() => this._process(), this._delay);
                } else {
                    await this._process();
                }
            }
        }
    }
}
