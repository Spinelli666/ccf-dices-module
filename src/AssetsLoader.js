export class AssetsLoader {
    static cache = {};

    constructor() {}

    async load(assets = []) {
        if (!Array.isArray(assets)) {
            assets = [assets]; // Ensure assets is always an array
        }

        const results = await Promise.all(assets.map(asset => this.loadAsset(asset)));

        // Return results with the URL as the key
        const combinedResults = {};
        results.forEach(result => {
            const key = Object.keys(result)[0];
            combinedResults[key] = result[key];
        });
        return combinedResults;
    }

    async loadAsset(asset) {
        if (AssetsLoader.cache[asset]) {
            // If a promise exists in the cache, await it and return the result
            return await AssetsLoader.cache[asset];
        }
    
        const assetPromise = (async () => {
            const isJson = asset.endsWith('.json');
            if (isJson) {
                // Load JSON and its associated images...
                const response = await fetch(asset);
                if (!response.ok) throw new Error(`Failed to load JSON asset: ${asset}`);
                const spritesheet = await response.json();
                const result = await this.loadSpriteSheet(asset, spritesheet);
                return { [asset]: result };
            } else {
                // Load a single image...
                const image = await this.loadImage(asset);
                const result = {source: image, frame: {x: 0, y: 0, w: image.width, h: image.height}};
                return { [asset]: result };
            }
        })();
    
        // Immediately store the promise in the cache
        AssetsLoader.cache[asset] = assetPromise;
    
        // Await the promise to load and cache the actual result, then return it
        const result = await assetPromise;
        // Replace the promise in the cache with the actual result for future requests
        AssetsLoader.cache[asset] = result;
        return result;
    }

    async loadSpriteSheet(url, spritesheet) {
        const dirPath = url.substring(0, url.lastIndexOf('/') + 1);
        const baseImageUrl = dirPath + spritesheet.meta.image;
        const image = await this.loadImage(baseImageUrl);
        
        const sprites = {};
        for (const [name, frameInfo] of Object.entries(spritesheet.frames)) {
            sprites[name] = {
                source: image,
                frame: frameInfo.frame
            };
        }
        
        if (spritesheet.meta.related_multi_packs) {
            await Promise.all(spritesheet.meta.related_multi_packs.map(pack => {
                return this.loadAdditionalPack(dirPath + pack, sprites);
            }));
        }

        // Do not change how sprites are cached, just return the flat structure
        return sprites;
    }

    async loadAdditionalPack(url, sprites) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to load additional spritesheet: ${url}`);
        const additionalSpritesheet = await response.json();
        const additionalImage = await this.loadImage(url.substring(0, url.lastIndexOf('/') + 1) + additionalSpritesheet.meta.image);
        
        for (const [name, frameInfo] of Object.entries(additionalSpritesheet.frames)) {
            sprites[name] = {
                source: additionalImage,
                frame: frameInfo.frame
            };
        }
    }

    async loadImage(url) {
        if (AssetsLoader.cache[url]) {
            return AssetsLoader.cache[url]; // Return from cache if already loaded
        }
        
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous"; // Handle CORS by setting the crossOrigin property
            img.onload = () => {
                AssetsLoader.cache[url] = img; // Cache the loaded image
                resolve(img);
            };
            img.onerror = () => {
                reject(new Error(`Failed to load image: ${url}`));
            };
            img.src = url;
        });
    }
}
