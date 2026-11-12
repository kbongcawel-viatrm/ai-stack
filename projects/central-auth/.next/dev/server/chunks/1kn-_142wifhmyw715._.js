module.exports = [
"[project]/central-auth/node_modules/agent-base/dist/src/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __importDefault = /*TURBOPACK member replacement*/ __turbopack_context__.e && /*TURBOPACK member replacement*/ __turbopack_context__.e.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : {
        "default": mod
    };
};
const events_1 = __turbopack_context__.r("[externals]/events [external] (events, cjs)");
const debug_1 = __importDefault(__turbopack_context__.r("[project]/central-auth/node_modules/debug/src/index.js [app-route] (ecmascript)"));
const promisify_1 = __importDefault(__turbopack_context__.r("[project]/central-auth/node_modules/agent-base/dist/src/promisify.js [app-route] (ecmascript)"));
const debug = debug_1.default('agent-base');
function isAgent(v) {
    return Boolean(v) && typeof v.addRequest === 'function';
}
function isSecureEndpoint() {
    const { stack } = new Error();
    if (typeof stack !== 'string') return false;
    return stack.split('\n').some((l)=>l.indexOf('(https.js:') !== -1 || l.indexOf('node:https:') !== -1);
}
function createAgent(callback, opts) {
    return new createAgent.Agent(callback, opts);
}
(function(createAgent) {
    /**
     * Base `http.Agent` implementation.
     * No pooling/keep-alive is implemented by default.
     *
     * @param {Function} callback
     * @api public
     */ class Agent extends events_1.EventEmitter {
        constructor(callback, _opts){
            super();
            let opts = _opts;
            if (typeof callback === 'function') {
                this.callback = callback;
            } else if (callback) {
                opts = callback;
            }
            // Timeout for the socket to be returned from the callback
            this.timeout = null;
            if (opts && typeof opts.timeout === 'number') {
                this.timeout = opts.timeout;
            }
            // These aren't actually used by `agent-base`, but are required
            // for the TypeScript definition files in `@types/node` :/
            this.maxFreeSockets = 1;
            this.maxSockets = 1;
            this.maxTotalSockets = Infinity;
            this.sockets = {};
            this.freeSockets = {};
            this.requests = {};
            this.options = {};
        }
        get defaultPort() {
            if (typeof this.explicitDefaultPort === 'number') {
                return this.explicitDefaultPort;
            }
            return isSecureEndpoint() ? 443 : 80;
        }
        set defaultPort(v) {
            this.explicitDefaultPort = v;
        }
        get protocol() {
            if (typeof this.explicitProtocol === 'string') {
                return this.explicitProtocol;
            }
            return isSecureEndpoint() ? 'https:' : 'http:';
        }
        set protocol(v) {
            this.explicitProtocol = v;
        }
        callback(req, opts, fn) {
            throw new Error('"agent-base" has no default implementation, you must subclass and override `callback()`');
        }
        /**
         * Called by node-core's "_http_client.js" module when creating
         * a new HTTP request with this Agent instance.
         *
         * @api public
         */ addRequest(req, _opts) {
            const opts = Object.assign({}, _opts);
            if (typeof opts.secureEndpoint !== 'boolean') {
                opts.secureEndpoint = isSecureEndpoint();
            }
            if (opts.host == null) {
                opts.host = 'localhost';
            }
            if (opts.port == null) {
                opts.port = opts.secureEndpoint ? 443 : 80;
            }
            if (opts.protocol == null) {
                opts.protocol = opts.secureEndpoint ? 'https:' : 'http:';
            }
            if (opts.host && opts.path) {
                // If both a `host` and `path` are specified then it's most
                // likely the result of a `url.parse()` call... we need to
                // remove the `path` portion so that `net.connect()` doesn't
                // attempt to open that as a unix socket file.
                delete opts.path;
            }
            delete opts.agent;
            delete opts.hostname;
            delete opts._defaultAgent;
            delete opts.defaultPort;
            delete opts.createConnection;
            // Hint to use "Connection: close"
            // XXX: non-documented `http` module API :(
            req._last = true;
            req.shouldKeepAlive = false;
            let timedOut = false;
            let timeoutId = null;
            const timeoutMs = opts.timeout || this.timeout;
            const onerror = (err)=>{
                if (req._hadError) return;
                req.emit('error', err);
                // For Safety. Some additional errors might fire later on
                // and we need to make sure we don't double-fire the error event.
                req._hadError = true;
            };
            const ontimeout = ()=>{
                timeoutId = null;
                timedOut = true;
                const err = new Error(`A "socket" was not created for HTTP request before ${timeoutMs}ms`);
                err.code = 'ETIMEOUT';
                onerror(err);
            };
            const callbackError = (err)=>{
                if (timedOut) return;
                if (timeoutId !== null) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                onerror(err);
            };
            const onsocket = (socket)=>{
                if (timedOut) return;
                if (timeoutId != null) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                if (isAgent(socket)) {
                    // `socket` is actually an `http.Agent` instance, so
                    // relinquish responsibility for this `req` to the Agent
                    // from here on
                    debug('Callback returned another Agent instance %o', socket.constructor.name);
                    socket.addRequest(req, opts);
                    return;
                }
                if (socket) {
                    socket.once('free', ()=>{
                        this.freeSocket(socket, opts);
                    });
                    req.onSocket(socket);
                    return;
                }
                const err = new Error(`no Duplex stream was returned to agent-base for \`${req.method} ${req.path}\``);
                onerror(err);
            };
            if (typeof this.callback !== 'function') {
                onerror(new Error('`callback` is not defined'));
                return;
            }
            if (!this.promisifiedCallback) {
                if (this.callback.length >= 3) {
                    debug('Converting legacy callback function to promise');
                    this.promisifiedCallback = promisify_1.default(this.callback);
                } else {
                    this.promisifiedCallback = this.callback;
                }
            }
            if (typeof timeoutMs === 'number' && timeoutMs > 0) {
                timeoutId = setTimeout(ontimeout, timeoutMs);
            }
            if ('port' in opts && typeof opts.port !== 'number') {
                opts.port = Number(opts.port);
            }
            try {
                debug('Resolving socket for %o request: %o', opts.protocol, `${req.method} ${req.path}`);
                Promise.resolve(this.promisifiedCallback(req, opts)).then(onsocket, callbackError);
            } catch (err) {
                Promise.reject(err).catch(callbackError);
            }
        }
        freeSocket(socket, opts) {
            debug('Freeing socket %o %o', socket.constructor.name, opts);
            socket.destroy();
        }
        destroy() {
            debug('Destroying agent %o', this.constructor.name);
        }
    }
    createAgent.Agent = Agent;
    // So that `instanceof` works correctly
    createAgent.prototype = createAgent.Agent.prototype;
})(createAgent || (createAgent = {}));
module.exports = createAgent;
}),
"[project]/central-auth/node_modules/agent-base/dist/src/promisify.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
function promisify(fn) {
    return function(req, opts) {
        return new Promise((resolve, reject)=>{
            fn.call(this, req, opts, (err, rtn)=>{
                if (err) {
                    reject(err);
                } else {
                    resolve(rtn);
                }
            });
        });
    };
}
exports.default = promisify;
}),
"[project]/central-auth/node_modules/asynckit/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

module.exports = {
    parallel: __turbopack_context__.r("[project]/central-auth/node_modules/asynckit/parallel.js [app-route] (ecmascript)"),
    serial: __turbopack_context__.r("[project]/central-auth/node_modules/asynckit/serial.js [app-route] (ecmascript)"),
    serialOrdered: __turbopack_context__.r("[project]/central-auth/node_modules/asynckit/serialOrdered.js [app-route] (ecmascript)")
};
}),
"[project]/central-auth/node_modules/asynckit/lib/abort.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

// API
module.exports = abort;
/**
 * Aborts leftover active jobs
 *
 * @param {object} state - current state object
 */ function abort(state) {
    Object.keys(state.jobs).forEach(clean.bind(state));
    // reset leftover jobs
    state.jobs = {};
}
/**
 * Cleans up leftover job by invoking abort function for the provided job id
 *
 * @this  state
 * @param {string|number} key - job id to abort
 */ function clean(key) {
    if (typeof this.jobs[key] == 'function') {
        this.jobs[key]();
    }
}
}),
"[project]/central-auth/node_modules/asynckit/lib/async.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

var defer = __turbopack_context__.r("[project]/central-auth/node_modules/asynckit/lib/defer.js [app-route] (ecmascript)");
// API
module.exports = async;
/**
 * Runs provided callback asynchronously
 * even if callback itself is not
 *
 * @param   {function} callback - callback to invoke
 * @returns {function} - augmented callback
 */ function async(callback) {
    var isAsync = false;
    // check if async happened
    defer(function() {
        isAsync = true;
    });
    return function async_callback(err, result) {
        if (isAsync) {
            callback(err, result);
        } else {
            defer(function nextTick_callback() {
                callback(err, result);
            });
        }
    };
}
}),
"[project]/central-auth/node_modules/asynckit/lib/defer.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

module.exports = defer;
/**
 * Runs provided function on next iteration of the event loop
 *
 * @param {function} fn - function to run
 */ function defer(fn) {
    var nextTick = typeof setImmediate == 'function' ? setImmediate : typeof process == 'object' && typeof process.nextTick == 'function' ? process.nextTick : null;
    if (nextTick) {
        nextTick(fn);
    } else {
        setTimeout(fn, 0);
    }
}
}),
"[project]/central-auth/node_modules/asynckit/lib/iterate.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

var async = __turbopack_context__.r("[project]/central-auth/node_modules/asynckit/lib/async.js [app-route] (ecmascript)"), abort = __turbopack_context__.r("[project]/central-auth/node_modules/asynckit/lib/abort.js [app-route] (ecmascript)");
// API
module.exports = iterate;
/**
 * Iterates over each job object
 *
 * @param {array|object} list - array or object (named list) to iterate over
 * @param {function} iterator - iterator to run
 * @param {object} state - current job status
 * @param {function} callback - invoked when all elements processed
 */ function iterate(list, iterator, state, callback) {
    // store current index
    var key = state['keyedList'] ? state['keyedList'][state.index] : state.index;
    state.jobs[key] = runJob(iterator, key, list[key], function(error, output) {
        // don't repeat yourself
        // skip secondary callbacks
        if (!(key in state.jobs)) {
            return;
        }
        // clean up jobs
        delete state.jobs[key];
        if (error) {
            // don't process rest of the results
            // stop still active jobs
            // and reset the list
            abort(state);
        } else {
            state.results[key] = output;
        }
        // return salvaged results
        callback(error, state.results);
    });
}
/**
 * Runs iterator over provided job element
 *
 * @param   {function} iterator - iterator to invoke
 * @param   {string|number} key - key/index of the element in the list of jobs
 * @param   {mixed} item - job description
 * @param   {function} callback - invoked after iterator is done with the job
 * @returns {function|mixed} - job abort function or something else
 */ function runJob(iterator, key, item, callback) {
    var aborter;
    // allow shortcut if iterator expects only two arguments
    if (iterator.length == 2) {
        aborter = iterator(item, async(callback));
    } else {
        aborter = iterator(item, key, async(callback));
    }
    return aborter;
}
}),
"[project]/central-auth/node_modules/asynckit/lib/state.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

// API
module.exports = state;
/**
 * Creates initial state object
 * for iteration over list
 *
 * @param   {array|object} list - list to iterate over
 * @param   {function|null} sortMethod - function to use for keys sort,
 *                                     or `null` to keep them as is
 * @returns {object} - initial state object
 */ function state(list, sortMethod) {
    var isNamedList = !Array.isArray(list), initState = {
        index: 0,
        keyedList: isNamedList || sortMethod ? Object.keys(list) : null,
        jobs: {},
        results: isNamedList ? {} : [],
        size: isNamedList ? Object.keys(list).length : list.length
    };
    if (sortMethod) {
        // sort array keys based on it's values
        // sort object's keys just on own merit
        initState.keyedList.sort(isNamedList ? sortMethod : function(a, b) {
            return sortMethod(list[a], list[b]);
        });
    }
    return initState;
}
}),
"[project]/central-auth/node_modules/asynckit/lib/terminator.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

var abort = __turbopack_context__.r("[project]/central-auth/node_modules/asynckit/lib/abort.js [app-route] (ecmascript)"), async = __turbopack_context__.r("[project]/central-auth/node_modules/asynckit/lib/async.js [app-route] (ecmascript)");
// API
module.exports = terminator;
/**
 * Terminates jobs in the attached state context
 *
 * @this  AsyncKitState#
 * @param {function} callback - final callback to invoke after termination
 */ function terminator(callback) {
    if (!Object.keys(this.jobs).length) {
        return;
    }
    // fast forward iteration index
    this.index = this.size;
    // abort jobs
    abort(this);
    // send back results we have so far
    async(callback)(null, this.results);
}
}),
"[project]/central-auth/node_modules/asynckit/parallel.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

var iterate = __turbopack_context__.r("[project]/central-auth/node_modules/asynckit/lib/iterate.js [app-route] (ecmascript)"), initState = __turbopack_context__.r("[project]/central-auth/node_modules/asynckit/lib/state.js [app-route] (ecmascript)"), terminator = __turbopack_context__.r("[project]/central-auth/node_modules/asynckit/lib/terminator.js [app-route] (ecmascript)");
// Public API
module.exports = parallel;
/**
 * Runs iterator over provided array elements in parallel
 *
 * @param   {array|object} list - array or object (named list) to iterate over
 * @param   {function} iterator - iterator to run
 * @param   {function} callback - invoked when all elements processed
 * @returns {function} - jobs terminator
 */ function parallel(list, iterator, callback) {
    var state = initState(list);
    while(state.index < (state['keyedList'] || list).length){
        iterate(list, iterator, state, function(error, result) {
            if (error) {
                callback(error, result);
                return;
            }
            // looks like it's the last one
            if (Object.keys(state.jobs).length === 0) {
                callback(null, state.results);
                return;
            }
        });
        state.index++;
    }
    return terminator.bind(state, callback);
}
}),
"[project]/central-auth/node_modules/asynckit/serial.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

var serialOrdered = __turbopack_context__.r("[project]/central-auth/node_modules/asynckit/serialOrdered.js [app-route] (ecmascript)");
// Public API
module.exports = serial;
/**
 * Runs iterator over provided array elements in series
 *
 * @param   {array|object} list - array or object (named list) to iterate over
 * @param   {function} iterator - iterator to run
 * @param   {function} callback - invoked when all elements processed
 * @returns {function} - jobs terminator
 */ function serial(list, iterator, callback) {
    return serialOrdered(list, iterator, null, callback);
}
}),
"[project]/central-auth/node_modules/asynckit/serialOrdered.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

var iterate = __turbopack_context__.r("[project]/central-auth/node_modules/asynckit/lib/iterate.js [app-route] (ecmascript)"), initState = __turbopack_context__.r("[project]/central-auth/node_modules/asynckit/lib/state.js [app-route] (ecmascript)"), terminator = __turbopack_context__.r("[project]/central-auth/node_modules/asynckit/lib/terminator.js [app-route] (ecmascript)");
// Public API
module.exports = serialOrdered;
// sorting helpers
module.exports.ascending = ascending;
module.exports.descending = descending;
/**
 * Runs iterator over provided sorted array elements in series
 *
 * @param   {array|object} list - array or object (named list) to iterate over
 * @param   {function} iterator - iterator to run
 * @param   {function} sortMethod - custom sort function
 * @param   {function} callback - invoked when all elements processed
 * @returns {function} - jobs terminator
 */ function serialOrdered(list, iterator, sortMethod, callback) {
    var state = initState(list, sortMethod);
    iterate(list, iterator, state, function iteratorHandler(error, result) {
        if (error) {
            callback(error, result);
            return;
        }
        state.index++;
        // are we there yet?
        if (state.index < (state['keyedList'] || list).length) {
            iterate(list, iterator, state, iteratorHandler);
            return;
        }
        // done here
        callback(null, state.results);
    });
    return terminator.bind(state, callback);
}
/*
 * -- Sort methods
 */ /**
 * sort helper to sort array elements in ascending order
 *
 * @param   {mixed} a - an item to compare
 * @param   {mixed} b - an item to compare
 * @returns {number} - comparison result
 */ function ascending(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
}
/**
 * sort helper to sort array elements in descending order
 *
 * @param   {mixed} a - an item to compare
 * @param   {mixed} b - an item to compare
 * @returns {number} - comparison result
 */ function descending(a, b) {
    return -1 * ascending(a, b);
}
}),
"[project]/central-auth/node_modules/axios-cache-interceptor/dist/index.mjs [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Header",
    ()=>Header,
    "buildKeyGenerator",
    ()=>buildKeyGenerator,
    "buildMemoryStorage",
    ()=>buildMemoryStorage,
    "buildStorage",
    ()=>buildStorage,
    "buildWebStorage",
    ()=>buildWebStorage,
    "canRemoveStorageEntry",
    ()=>canRemoveStorageEntry,
    "canStale",
    ()=>canStale,
    "createCacheResponse",
    ()=>createCacheResponse,
    "createValidateStatus",
    ()=>createValidateStatus,
    "defaultHeaderInterpreter",
    ()=>defaultHeaderInterpreter,
    "defaultKeyGenerator",
    ()=>defaultKeyGenerator,
    "defaultRequestInterceptor",
    ()=>defaultRequestInterceptor,
    "defaultResponseInterceptor",
    ()=>defaultResponseInterceptor,
    "isExpired",
    ()=>isExpired,
    "isMethodIn",
    ()=>isMethodIn,
    "isStorage",
    ()=>isStorage,
    "mustRevalidate",
    ()=>mustRevalidate,
    "regexOrStringMatch",
    ()=>regexOrStringMatch,
    "setupCache",
    ()=>setupCache,
    "storageEntriesSorter",
    ()=>storageEntriesSorter,
    "testCachePredicate",
    ()=>testCachePredicate,
    "updateCache",
    ()=>updateCache,
    "updateStaleRequest",
    ()=>updateStaleRequest
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$cache$2d$parser$2f$dist$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/cache-parser/dist/index.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$fast$2d$defer$2f$dist$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/fast-defer/dist/index.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$http$2d$vary$2f$dist$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/http-vary/dist/index.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$object$2d$code$2f$dist$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/object-code/dist/index.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$try$2f$lib$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/try/lib/index.js [app-route] (ecmascript)");
;
;
;
;
;
//#region src/header/headers.ts
/**
* @deprecated This constant will be hidden in future versions. Please tell us why you need it at https://github.com/arthurfiorette/axios-cache-interceptor/issues/1158
*/ const Header = {
    /**
	* ```txt
	* If-Modified-Since: <day-name>, <day> <month> <year> <hour>:<minute>:<second> GMT
	* ```
	*
	* @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Modified-Since
	*/ IfModifiedSince: "if-modified-since",
    /**
	* ```txt
	* Last-Modified: <day-name>, <day> <month> <year> <hour>:<minute>:<second> GMT
	* ```
	*
	* @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Last-Modified
	*/ LastModified: "last-modified",
    /**
	* ```txt
	* If-None-Match: "<etag_value>"
	* If-None-Match: "<etag_value>", "<etag_value>", …
	* If-None-Match: *
	* ```
	*
	* @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-None-Match
	*/ IfNoneMatch: "if-none-match",
    /**
	* ```txt
	* Cache-Control: max-age=604800
	* ```
	*
	* @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control
	*/ CacheControl: "cache-control",
    /**
	* ```txt
	* Pragma: no-cache
	* ```
	*
	* @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Pragma
	*/ Pragma: "pragma",
    /**
	* ```txt
	* ETag: W/"<etag_value>"
	* ETag: "<etag_value>"
	* ```
	*
	* @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag
	*/ ETag: "etag",
    /**
	* ```txt
	* Expires: <http-date>
	* ```
	*
	* @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Expires
	*/ Expires: "expires",
    /**
	* ```txt
	* Age: <delta-seconds>
	* ```
	*
	* @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Age
	*/ Age: "age",
    /**
	* Used internally as metadata to mark the cache item as revalidatable and enable the
	* stale cache state. Contains a string of ASCII characters that can be used as an ETag
	* for the `If-None-Match` header. Provided by the user through the `cache.etag` value.
	*
	* ```txt
	* X-Axios-Cache-Etag: "<etag_value>"
	* ```
	*/ XAxiosCacheEtag: "x-axios-cache-etag",
    /**
	* Used internally as metadata to mark the cache item as revalidatable and enable the
	* stale cache state. It may contain `'use-cache-timestamp'` if `cache.modifiedSince` is
	* `true`, otherwise will contain a date from `cache.modifiedSince`. If a date is
	* provided, it can be used for `If-Modified-Since` header, otherwise the cache
	* timestamp can be used for `If-Modified-Since` header.
	*
	* ```txt
	* X-Axios-Cache-Last-Modified: <day-name>, <day> <month> <year> <hour>:<minute>:<second> GMT
	* X-Axios-Cache-Last-Modified: use-cache-timestamp
	* ```
	*/ XAxiosCacheLastModified: "x-axios-cache-last-modified",
    /**
	* Used internally as metadata to mark the cache item able to be used if the server
	* returns an error. The stale-if-error response directive indicates that the cache can
	* reuse a stale response when any error occurs.
	*
	* ```txt
	* XAxiosCacheStaleIfError: <seconds>
	* ```
	*/ XAxiosCacheStaleIfError: "x-axios-cache-stale-if-error",
    /**
	* Indicates which request headers affect the response content.
	* Used to prevent cache poisoning when responses differ based on request headers.
	*
	* ```txt
	* Vary: Authorization
	* Vary: Authorization, Accept-Language
	* Vary: *
	* ```
	*
	* @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Vary
	*/ Vary: "vary"
};
//#endregion
//#region src/header/interpreter.ts
/**
* @deprecated This function will be hidden in future versions. Please tell us why you need it at https://github.com/arthurfiorette/axios-cache-interceptor/issues/1158
*/ const defaultHeaderInterpreter = (headers, location)=>{
    if (!headers) return "not enough headers";
    const cacheControl = headers[Header.CacheControl];
    if (cacheControl) {
        const cc = (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$cache$2d$parser$2f$dist$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["parse"])(String(cacheControl));
        if (cc.noCache || cc.noStore || location === "server" && cc.private) return "dont cache";
        if (cc.immutable) return {
            cache: 31536e6
        };
        if (cc.maxAge !== void 0) {
            const age = headers[Header.Age];
            return {
                cache: age ? (cc.maxAge - Number(age)) * 1e3 : cc.maxAge * 1e3,
                stale: cc.maxStale !== void 0 ? cc.maxStale * 1e3 : cc.staleWhileRevalidate !== void 0 ? cc.staleWhileRevalidate * 1e3 : void 0
            };
        }
    }
    const expires = headers[Header.Expires];
    if (expires) {
        const milliseconds = Date.parse(String(expires)) - Date.now();
        return milliseconds >= 0 ? {
            cache: milliseconds
        } : "dont cache";
    }
    return "not enough headers";
};
//#endregion
//#region src/header/extract.ts
/**
* Extracts specified header values from request headers.
* Generic utility for extracting a subset of headers.
*
* @param requestHeaders The full request headers object
* @param headerNames Array of header names to extract
* @returns Object with extracted header values
*/ function extractHeaders(requestHeaders, headerNames) {
    const result = {};
    for (const name of headerNames)result[name] = requestHeaders.get(name)?.toString();
    return result;
}
//#endregion
//#region src/util/cache-predicate.ts
/**
* Tests a response against a {@link CachePredicateObject}.
*
* @deprecated This function will be hidden in future versions. Please tell us why you need it at https://github.com/arthurfiorette/axios-cache-interceptor/issues/1158
*/ async function testCachePredicate(response, predicate) {
    if (typeof predicate === "function") return predicate(response);
    const { statusCheck, responseMatch, containsHeaders } = predicate;
    if (statusCheck && !await statusCheck(response.status) || responseMatch && !await responseMatch(response)) return false;
    if (containsHeaders) {
        for (const [header, predicate] of Object.entries(containsHeaders))if (!await predicate(response.headers[header.toLowerCase()] ?? response.headers[header])) return false;
    }
    return true;
}
/**
* Determines whether a given URL matches a specified pattern, which can be either a
* string or a regular expression.
*
* @param matchPattern - The pattern to match against
*
*   - If it's a regular expression, it will be reset to ensure consistent behavior for
*       stateful regular expressions.
*   - If it's a string, the function checks if the URL contains the string.
*
* @param configUrl - The URL to test against the provided pattern; normally `config.url`.
* @returns `true` if the `configUrl` matches the `matchPattern`
*
* @deprecated This function will be hidden in future versions. Please tell us why you need it at https://github.com/arthurfiorette/axios-cache-interceptor/issues/1158
*/ function regexOrStringMatch(matchPattern, configUrl) {
    if (matchPattern instanceof RegExp) {
        matchPattern.lastIndex = 0;
        return matchPattern.test(configUrl);
    }
    return configUrl.includes(matchPattern);
}
//#endregion
//#region src/interceptors/util.ts
/**
* Creates a new validateStatus function that will use the one already used and also
* accept status code 304.
*
* @deprecated This function will be hidden in future versions. Please tell us why you need it at https://github.com/arthurfiorette/axios-cache-interceptor/issues/1158
*/ function createValidateStatus(oldValidate) {
    return oldValidate ? (status)=>oldValidate(status) || status === 304 : (status)=>status >= 200 && status < 300 || status === 304;
}
/**
* Checks if the given method is in the methods array
*
* @deprecated This function will be hidden in future versions. Please tell us why you need it at https://github.com/arthurfiorette/axios-cache-interceptor/issues/1158
*/ function isMethodIn(requestMethod = "get", methodList = []) {
    requestMethod = requestMethod.toLowerCase();
    return methodList.some((method)=>method === requestMethod);
}
/**
* This function updates the cache when the request is stale. So, the next request to the
* server will be made with proper header / settings.
*
* @deprecated This function will be hidden in future versions. Please tell us why you need it at https://github.com/arthurfiorette/axios-cache-interceptor/issues/1158
*/ function updateStaleRequest(cache, config) {
    const { etag, modifiedSince } = config.cache;
    const revalidation = cache.data?.meta?.revalidation;
    if (etag) {
        let etagValue;
        if (revalidation?.etag) etagValue = revalidation.etag;
        else if (etag === true) etagValue = cache.data?.headers[Header.ETag];
        else etagValue = etag;
        if (etagValue) config.headers.set(Header.IfNoneMatch, etagValue);
    }
    if (modifiedSince) {
        let lastModifiedValue;
        if (revalidation?.lastModified) lastModifiedValue = revalidation.lastModified === true ? new Date(cache.createdAt).toUTCString() : revalidation.lastModified;
        else if (modifiedSince === true) lastModifiedValue = cache.data.headers[Header.LastModified] || new Date(cache.createdAt).toUTCString();
        else lastModifiedValue = modifiedSince.toUTCString();
        config.headers.set(Header.IfModifiedSince, lastModifiedValue);
    }
}
/**
* Creates the new date to the cache by the provided response. Also handles possible 304
* Not Modified by updating response properties.
*
* @deprecated This function will be hidden in future versions. Please tell us why you need it at https://github.com/arthurfiorette/axios-cache-interceptor/issues/1158
*/ function createCacheResponse(response, previousCache) {
    if (response.status === 304 && previousCache) {
        response.cached = true;
        response.data = previousCache.data;
        response.status = previousCache.status;
        response.statusText = previousCache.statusText;
        response.headers = {
            ...previousCache.headers,
            ...response.headers
        };
        return previousCache;
    }
    return {
        data: response.data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
    };
}
//#endregion
//#region src/interceptors/request.ts
/**
* @deprecated This function will be hidden in future versions. Please tell us why you need it at https://github.com/arthurfiorette/axios-cache-interceptor/issues/1158
*/ function defaultRequestInterceptor(axios) {
    const onFulfilled = async (config)=>{
        config.id = axios.generateKey(config, {
            vary: config.cache && Array.isArray(config.cache.vary) ? extractHeaders(config.headers, config.cache.vary) : void 0
        });
        if (config.cache === false) return config;
        config.cache = {
            ...axios.defaults.cache,
            ...config.cache
        };
        if (config.cache.enabled === false) return config;
        if (typeof config.cache.cachePredicate === "object" && config.cache.cachePredicate.ignoreUrls && config.url) {
            for (const url of config.cache.cachePredicate.ignoreUrls)if (regexOrStringMatch(url, config.url)) return config;
        }
        if (typeof config.cache.cachePredicate === "object" && config.cache.cachePredicate.allowUrls && config.url) {
            let matched = false;
            for (const url of config.cache.cachePredicate.allowUrls)if (regexOrStringMatch(url, config.url)) {
                matched = true;
                break;
            }
            if (!matched) return config;
        }
        if (config.cache.cacheTakeover) {
            config.headers.set(Header.CacheControl, "no-cache, no-store, must-revalidate, max-age=0", false);
            config.headers.set(Header.Pragma, "no-cache", false);
            config.headers.set(Header.Expires, "0", false);
        }
        if (!isMethodIn(config.method, config.cache.methods)) return config;
        let cache = await axios.storage.get(config.id, config);
        const overrideCache = config.cache.override;
        if (config.cache.vary !== false && cache.data?.meta?.vary && cache.data.headers[Header.Vary]) {
            const vary = Array.isArray(config.cache.vary) ? config.cache.vary : (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$http$2d$vary$2f$dist$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["parse"])(cache.data.headers[Header.Vary]);
            if (vary && vary !== "*" && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$http$2d$vary$2f$dist$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["compare"])(vary, cache.data.meta?.vary, config.headers)) {
                const extractedHeaders = extractHeaders(config.headers, vary);
                const newKey = axios.generateKey({
                    ...config,
                    id: void 0
                }, {
                    vary: extractedHeaders
                });
                if (config.id !== newKey) {
                    config.id = newKey;
                    cache = await axios.storage.get(newKey, config);
                }
            }
        }
        ignoreAndRequest: if (cache.state === "empty" || cache.state === "stale" || cache.state === "must-revalidate" || overrideCache) {
            if (axios.waiting.has(config.id) && !overrideCache) {
                cache = await axios.storage.get(config.id, config);
                if (cache.state !== "empty" && cache.state !== "must-revalidate") break ignoreAndRequest;
            }
            const def = (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$fast$2d$defer$2f$dist$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["deferred"])();
            axios.waiting.set(config.id, def);
            def.catch(()=>void 0);
            await axios.storage.set(config.id, {
                state: "loading",
                previous: overrideCache ? cache.data ? "stale" : "empty" : cache.state,
                data: cache.data,
                createdAt: overrideCache && !cache.createdAt ? Date.now() : cache.createdAt
            }, config);
            if ((cache.state === "stale" || cache.state === "must-revalidate") && !overrideCache) updateStaleRequest(cache, {
                ...config,
                cache: config.cache
            });
            config.validateStatus = createValidateStatus(config.validateStatus);
            if (cache.state === "stale" || cache.data && cache.state !== "must-revalidate") await config.cache.hydrate?.(cache);
            return config;
        }
        let cachedResponse;
        if (cache.state === "loading") {
            const deferred = axios.waiting.get(config.id);
            if (!deferred) {
                if (cache.data) await config.cache.hydrate?.(cache);
                return config;
            }
            try {
                await deferred;
                const state = await axios.storage.get(config.id, config);
                /* c8 ignore start */ if (!state.data) return onFulfilled(config);
                /* c8 ignore end */ if (config.cache.vary !== false && state.data.headers[Header.Vary]) {
                    const vary = Array.isArray(config.cache.vary) ? config.cache.vary : (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$http$2d$vary$2f$dist$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["parse"])(state.data.headers[Header.Vary]);
                    const cachedVary = state.data.meta?.vary;
                    if (vary === "*" || vary && cachedVary && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$http$2d$vary$2f$dist$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["compare"])(vary, cachedVary, config.headers)) return onFulfilled(config);
                }
                cachedResponse = state.data;
            } catch (err) {
                throw err;
            }
        } else cachedResponse = cache.data;
        config.transformResponse = void 0;
        config.adapter = function cachedAdapter() {
            return Promise.resolve({
                config,
                data: cachedResponse.data,
                headers: cachedResponse.headers,
                status: cachedResponse.status,
                statusText: cachedResponse.statusText,
                cached: true,
                stale: cache.previous === "stale",
                id: config.id
            });
        };
        return config;
    };
    return {
        onFulfilled
    };
}
//#endregion
//#region src/util/update-cache.ts
/**
* Function to update all caches, from CacheProperties.update, with the new data.
*
* @deprecated This function will be hidden in future versions. Please tell us why you need it at https://github.com/arthurfiorette/axios-cache-interceptor/issues/1158
*/ async function updateCache(storage, data, cacheUpdater) {
    if (typeof cacheUpdater === "function") return cacheUpdater(data);
    for (const [cacheKey, updater] of Object.entries(cacheUpdater)){
        if (updater === "delete") {
            await storage.remove(cacheKey, data.config);
            continue;
        }
        const value = await storage.get(cacheKey, data.config);
        if (value.state === "loading") continue;
        const newValue = await updater(value, data);
        if (newValue === "delete") {
            await storage.remove(cacheKey, data.config);
            continue;
        }
        if (newValue !== "ignore") await storage.set(cacheKey, newValue, data.config);
    }
}
//#endregion
//#region src/interceptors/response.ts
/**
* @deprecated This function will be hidden in future versions. Please tell us why you need it at https://github.com/arthurfiorette/axios-cache-interceptor/issues/1158
*/ function defaultResponseInterceptor(axios) {
    /**
	* Resolves or rejects a deferred stored in the axios waiting map. Use resolve to proceed
	* checking the previously updated cache or reject to abort deduplicated requests with an error.
	*/ const replyDeferred = (responseId, mode, error)=>{
        const deferred = axios.waiting.get(responseId);
        if (deferred) {
            deferred[mode](error);
            axios.waiting.delete(responseId);
        }
    };
    const onFulfilled = async (response)=>{
        if (!response?.config) throw response;
        response.id = response.config.id;
        response.cached ??= false;
        const config = response.config;
        const cacheConfig = config.cache;
        if (response.cached) return response;
        if (!cacheConfig) {
            response.cached = false;
            return response;
        }
        if (cacheConfig.update) await updateCache(axios.storage, response, cacheConfig.update);
        if (!isMethodIn(config.method, cacheConfig.methods)) return response;
        const cache = await axios.storage.get(response.id, config);
        if (cache.state !== "loading") {
            replyDeferred(response.id, "resolve");
            return response;
        }
        if (!cache.data && !await testCachePredicate(response, cacheConfig.cachePredicate)) {
            replyDeferred(response.id, "resolve");
            return response;
        }
        for (const header of Object.keys(response.headers))if (header.startsWith("x-axios-cache")) delete response.headers[header];
        let ttl = cacheConfig.ttl || -1;
        let staleTtl;
        if (cacheConfig.interpretHeader) {
            const expirationTime = axios.headerInterpreter(response.headers, axios.location);
            if (expirationTime === "dont cache") {
                replyDeferred(response.id, "resolve");
                return response;
            }
            if (expirationTime !== "not enough headers") {
                if (typeof expirationTime === "number") ttl = expirationTime;
                else {
                    ttl = expirationTime.cache;
                    staleTtl = expirationTime.stale;
                }
            }
        }
        if (typeof ttl === "function") ttl = await ttl(response);
        const data = createCacheResponse(response, cache.data);
        if (cacheConfig.etag || cacheConfig.modifiedSince) {
            data.meta ??= {};
            data.meta.revalidation = {};
            if (cacheConfig.etag) {
                const etag = cacheConfig.etag === true ? response.headers[Header.ETag] : cacheConfig.etag;
                if (etag) data.meta.revalidation.etag = etag;
            }
            if (cacheConfig.modifiedSince) data.meta.revalidation.lastModified = cacheConfig.modifiedSince === true ? response.headers[Header.LastModified] || true : cacheConfig.modifiedSince.toUTCString();
        }
        if (cacheConfig.vary !== false && response.headers[Header.Vary]) {
            const vary = Array.isArray(cacheConfig.vary) ? cacheConfig.vary : (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$http$2d$vary$2f$dist$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["parse"])(response.headers[Header.Vary]);
            if (Array.isArray(vary)) {
                data.meta ??= {};
                data.meta.vary = extractHeaders(config.headers, vary);
            } else if (vary === "*") {
                await axios.storage.set(response.id, {
                    state: "stale",
                    createdAt: Date.now(),
                    data,
                    ttl
                }, config);
                replyDeferred(response.id, "resolve");
                return response;
            }
        }
        const newCache = {
            state: "cached",
            ttl,
            staleTtl,
            createdAt: Date.now(),
            data
        };
        await axios.storage.set(response.id, newCache, config);
        replyDeferred(response.id, "resolve");
        return response;
    };
    const onRejected = async (error)=>{
        if (!error.isAxiosError || !error.config) throw error;
        const config = error.config;
        const id = config.id;
        const cacheConfig = config.cache;
        const response = error.response;
        if (!cacheConfig || !id) throw error;
        if (!isMethodIn(config.method, cacheConfig.methods)) {
            await axios.storage.remove(id, config);
            replyDeferred(id, "reject", error);
            throw error;
        }
        const cache = await axios.storage.get(id, config);
        if (cache.state !== "loading" || cache.previous !== "stale") {
            if (error.code !== "ERR_CANCELED" || error.code === "ERR_CANCELED" && cache.state !== "cached") await axios.storage.remove(id, config);
            if (error.code === "ERR_CANCELED") replyDeferred(id, "resolve");
            else replyDeferred(id, "reject", error);
            throw error;
        }
        if (cacheConfig.staleIfError) {
            const cacheControl = String(response?.headers[Header.CacheControl]);
            const staleHeader = cacheControl && (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$cache$2d$parser$2f$dist$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["parse"])(cacheControl).staleIfError;
            const staleIfError = typeof cacheConfig.staleIfError === "function" ? await cacheConfig.staleIfError(response, cache, error) : cacheConfig.staleIfError === true && staleHeader ? staleHeader * 1e3 : cacheConfig.staleIfError;
            if (staleIfError === true || typeof staleIfError === "number" && cache.createdAt + staleIfError > Date.now()) {
                await axios.storage.set(id, {
                    state: "stale",
                    createdAt: Date.now(),
                    data: cache.data
                }, config);
                const waiting = axios.waiting.get(id);
                if (waiting) {
                    waiting.resolve();
                    axios.waiting.delete(id);
                }
                return {
                    cached: true,
                    stale: true,
                    config,
                    id,
                    data: cache.data.data,
                    headers: cache.data.headers,
                    status: cache.data.status,
                    statusText: cache.data.statusText
                };
            }
        }
        await axios.storage.remove(id, config);
        replyDeferred(id, "reject", error);
        throw error;
    };
    return {
        onFulfilled,
        onRejected
    };
}
//#endregion
//#region src/storage/build.ts
/**
* Returns true if the provided object was created by the {@link buildStorage} function.
*
* @deprecated This function will be hidden in future versions. Please tell us why you need it at https://github.com/arthurfiorette/axios-cache-interceptor/issues/1158
*/ const isStorage = (obj)=>!!obj && !!obj["is-storage"];
/**
* Migrates old header-based revalidation data to new meta.revalidation format.
* This ensures backward compatibility with existing cache entries.
*
* @deprecated Internal migration function. Will be removed when all cache entries
* have naturally expired and been recreated with new format.
*/ function migrateRevalidationHeaders(data) {
    if (data.meta?.revalidation) return;
    const oldEtag = data.headers[Header.XAxiosCacheEtag];
    const oldLastModified = data.headers[Header.XAxiosCacheLastModified];
    if (oldEtag || oldLastModified) {
        data.meta ??= {};
        data.meta.revalidation = {};
        if (oldEtag) data.meta.revalidation.etag = oldEtag;
        if (oldLastModified) data.meta.revalidation.lastModified = oldLastModified === "use-cache-timestamp" ? true : oldLastModified;
        delete data.headers[Header.XAxiosCacheEtag];
        delete data.headers[Header.XAxiosCacheLastModified];
        delete data.headers[Header.XAxiosCacheStaleIfError];
    }
}
function hasRevalidationMetadata(value) {
    migrateRevalidationHeaders(value.data);
    const headers = value.data.headers;
    const revalidation = value.data.meta?.revalidation;
    return Header.ETag in headers || Header.LastModified in headers || !!(revalidation?.etag || revalidation?.lastModified);
}
/** Returns true if value must be revalidated */ function mustRevalidate(value) {
    return String(value.data.headers[Header.CacheControl]).includes("must-revalidate");
}
/** Returns true if this has sufficient properties to become stale instead of expiring. */ function canStale(value) {
    if (hasRevalidationMetadata(value)) return true;
    return value.state === "cached" && value.staleTtl !== void 0 && Math.abs(Date.now() - (value.createdAt + value.ttl)) <= value.staleTtl;
}
/**
* Checks if the provided cache is expired. You should also check if the cache
* {@link canStale} and {@link mayUseStale}
*/ function isExpired(value) {
    return value.ttl !== void 0 && value.createdAt + value.ttl <= Date.now();
}
/**
* Defines which storage states are evicted first when cleaning up the storage.
*/ const StateEvictionOrder = {
    empty: 0,
    "must-revalidate": 1,
    stale: 2,
    cached: 3,
    loading: 4
};
/**
* Is a comparator function that sorts storage entries by their eviction priority
* and, within the same group, by oldest first.
*/ function storageEntriesSorter([, a], [, b]) {
    const stateDiff = StateEvictionOrder[a.state] - StateEvictionOrder[b.state];
    if (stateDiff !== 0) return stateDiff;
    return (a.createdAt || 0) - (b.createdAt || 0);
}
/**
* Returns true if the storage entry can be removed according to its state and the
* provided maxStaleAge.
*/ function canRemoveStorageEntry(value, maxStaleAge) {
    switch(value.state){
        case "loading":
            return false;
        case "empty":
        case "must-revalidate":
            return true;
        case "cached":
            return isExpired(value) && !canStale(value);
        case "stale":
            if (maxStaleAge !== void 0 && value.ttl !== void 0) return Date.now() > value.createdAt + value.ttl + maxStaleAge;
            return false;
    }
}
/**
* All integrated storages are wrappers around the `buildStorage` function. External
* libraries use it and if you want to build your own, `buildStorage` is the way to go!
*
* The exported `buildStorage` function abstracts the storage interface and requires a
* super simple object to build the storage.
*
* **Note**: You can only create custom storages with this function.
*
* @example
*
* ```js
* const myStorage = buildStorage({
*   find: () => {...},
*   set: () => {...},
*   remove: () => {...},
*   clear: () => {...}
* });
*
* const axios = setupCache(axios, { storage: myStorage });
* ```
*
* @see https://axios-cache-interceptor.js.org/guide/storages#buildstorage
*/ function buildStorage({ set, find, remove, clear }) {
    return {
        "is-storage": 1,
        set,
        remove,
        clear,
        get: async (key, config)=>{
            let value = await find(key, config);
            if (!value) return {
                state: "empty"
            };
            if (value.state === "empty" || value.state === "loading" || value.state === "must-revalidate") return value;
            if (value.state === "cached" || value.state === "stale") migrateRevalidationHeaders(value.data);
            if (value.state === "cached") {
                if (!isExpired(value)) return value;
                if (!canStale(value)) {
                    await remove(key, config);
                    return {
                        state: "empty"
                    };
                }
                value = {
                    state: "stale",
                    createdAt: value.createdAt,
                    data: value.data,
                    ttl: value.staleTtl !== void 0 ? value.staleTtl + value.ttl : void 0
                };
                await set(key, value, config);
                if (mustRevalidate(value)) return {
                    ...value,
                    state: "must-revalidate"
                };
            }
            if (!isExpired(value)) return value;
            if (hasRevalidationMetadata(value)) return value;
            await remove(key, config);
            return {
                state: "empty"
            };
        }
    };
}
//#endregion
//#region src/storage/memory.ts
/* c8 ignore start */ /**
* Clones an object using the structured clone algorithm if available, otherwise it uses
* JSON.parse(JSON.stringify(value)).
*/ const clone = typeof structuredClone === "function" ? structuredClone : (value)=>JSON.parse(JSON.stringify(value));
/* c8 ignore stop */ /**
* Creates a simple in-memory storage. This means that if you need to persist data between
* page or server reloads, this will not help.
*
* This is the storage used by default.
*
* If you need to modify its data, you can do so through the `data` property.
*
* @example
*
* ```js
* const memoryStorage = buildMemoryStorage();
*
* setupCache(axios, { storage: memoryStorage });
*
* // Simple example to force delete the request cache
*
* const { id } = axios.get('url');
*
* delete memoryStorage.data[id];
* ```
*
* @param {boolean | 'double'} cloneData Use `true` if the data returned by `find()`
*   should be cloned to avoid mutating the original data outside the `set()` method. Use
*   `'double'` to also clone before saving value in storage using `set()`. Disabled by
*   default.
* @param {number | false} cleanupInterval The interval in milliseconds to run a
*   setInterval job of cleaning old entries. If false, the job will not be created.
*   5 minutes (300_000) is default
* @param {number | false} maxEntries The maximum number of entries to keep in the
*   storage. It's hard to determine the size of the entries, so a smart FIFO order is used
*   to determine eviction. If false, no check will be done and you may increase memory
*   usage. 1024 is default
* @param {number} maxStaleAge The maximum age in milliseconds a stale entry can stay
*   in the storage before being removed. Otherwise, stale-able entries would stay
*   indefinitely, eventually causing a memory leak. 1 hour (3_600_000) is default
*/ function buildMemoryStorage(cloneData = false, cleanupInterval = 3e5, maxEntries = 1024, maxStaleAge = 36e5) {
    function sortedEntries() {
        return Array.from(storage.data.entries()).sort(storageEntriesSorter);
    }
    const storage = buildStorage({
        set: (key, value)=>{
            if (maxEntries && storage.data.size >= maxEntries) {
                storage.cleanup();
                if (storage.data.size >= maxEntries) for (const [key] of sortedEntries()){
                    storage.data.delete(key);
                    if (storage.data.size < maxEntries) break;
                }
            }
            storage.data.set(key, cloneData === "double" ? clone(value) : value);
        },
        remove: (key)=>{
            storage.data.delete(key);
        },
        find: (key)=>{
            const value = storage.data.get(key);
            return cloneData && value !== void 0 ? clone(value) : value;
        },
        clear: ()=>{
            storage.data.clear();
        }
    });
    storage.data = /* @__PURE__ */ new Map();
    storage.cleanup = ()=>{
        for (const [key, value] of sortedEntries())if (canRemoveStorageEntry(value, maxStaleAge)) storage.data.delete(key);
    };
    if (cleanupInterval) {
        storage.cleaner = setInterval(storage.cleanup, cleanupInterval);
        if (typeof storage.cleaner === "object" && "unref" in storage.cleaner) storage.cleaner.unref();
    }
    return storage;
}
//#endregion
//#region src/util/key-generator.ts
const SLASHES_REGEX = /^\/|\/$/g;
/**
* Builds a generator that receives a {@link CacheRequestConfig} and optional metadata,
* and returns a value hashed by {@link hash}.
*
* The value is hashed into a signed integer when the returned value from the provided
* generator is not a `string` or a `number`.
*
* You can return any type of data structure.
*
* @example
*
* ```js
* // This generator will return a hash code.
* // The code will only be the same if url, method and data are the same.
* const generator = buildKeyGenerator(({ url, method, data }) => ({
*   url,
*   method,
*   data
* }));
* ```
*/ function buildKeyGenerator(generator) {
    return (request, meta)=>{
        if (request.id) return request.id;
        const key = generator(request, meta);
        if (typeof key === "string" || typeof key === "number") return `${key}`;
        return `${(0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$object$2d$code$2f$dist$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["hash"])(key)}`;
    };
}
/**
* @deprecated This function will be hidden in future versions. Please tell us why you need it at https://github.com/arthurfiorette/axios-cache-interceptor/issues/1158
*/ const defaultKeyGenerator = buildKeyGenerator(({ baseURL, url, method, params, data }, meta)=>{
    if (baseURL !== void 0) baseURL = baseURL.replace(SLASHES_REGEX, "");
    else baseURL = "";
    if (url !== void 0) url = url.replace(SLASHES_REGEX, "");
    else url = "";
    if (method !== void 0) method = method.toLowerCase();
    else method = "get";
    return {
        url: baseURL + (baseURL && url ? "/" : "") + url,
        params,
        method,
        data,
        ...meta
    };
});
//#endregion
//#region src/cache/create.ts
/**
* Apply the caching interceptors for an already-created Axios instance.
*
* ```ts
* const axios = setupCache(axios, OPTIONS);
* ```
*
* The `setupCache` function receives global options and all
* [request-specific](https://axios-cache-interceptor.js.org/config/request-specifics) options too.
* This way, you can customize the defaults for all requests.
*
* @param axios The already created axios instance
* @param config The config for the caching interceptors
* @returns The same instance with extended TypeScript types.
* @see https://axios-cache-interceptor.js.org/config
*/ function setupCache(axios, options = {}) {
    const axiosCache = axios;
    if (axiosCache.defaults.cache) throw new Error("setupCache() should be called only once");
    axiosCache.location = ("TURBOPACK compile-time truthy", 1) ? "server" : "TURBOPACK unreachable";
    axiosCache.storage = options.storage || buildMemoryStorage();
    if (!isStorage(axiosCache.storage)) throw new Error("Use buildStorage() function");
    axiosCache.waiting = options.waiting || /* @__PURE__ */ new Map();
    axiosCache.generateKey = options.generateKey || defaultKeyGenerator;
    axiosCache.headerInterpreter = options.headerInterpreter || defaultHeaderInterpreter;
    axiosCache.requestInterceptor = options.requestInterceptor || defaultRequestInterceptor(axiosCache);
    axiosCache.responseInterceptor = options.responseInterceptor || defaultResponseInterceptor(axiosCache);
    axiosCache.debug = options.debug || function noop() {};
    axiosCache.defaults.cache = {
        enabled: options.enabled ?? true,
        update: options.update || {},
        ttl: options.ttl ?? 3e5,
        methods: options.methods || [
            "get",
            "head"
        ],
        cachePredicate: options.cachePredicate || {
            statusCheck: (status)=>[
                    200,
                    203,
                    300,
                    301,
                    302,
                    404,
                    405,
                    410,
                    414,
                    501
                ].includes(status)
        },
        etag: options.etag ?? true,
        modifiedSince: options.modifiedSince ?? options.etag === false,
        interpretHeader: options.interpretHeader ?? true,
        cacheTakeover: options.cacheTakeover ?? true,
        staleIfError: options.staleIfError ?? true,
        override: options.override ?? false,
        hydrate: options.hydrate ?? void 0,
        vary: options.vary ?? true
    };
    if (options.register ?? true) {
        axiosCache.interceptors.request.use(axiosCache.requestInterceptor.onFulfilled, axiosCache.requestInterceptor.onRejected);
        axiosCache.interceptors.response.use(axiosCache.responseInterceptor.onFulfilled, axiosCache.responseInterceptor.onRejected);
    }
    return axiosCache;
}
//#endregion
//#region src/storage/web-api.ts
/**
* Creates a simple storage. You can persist its data by using `sessionStorage` or
* `localStorage` with it.
*
* **ImplNote**: Without polyfill, this storage only works in browser environments.
*
* @example
*
* ```js
* const fromLocalStorage = buildWebStorage(localStorage);
* const fromSessionStorage = buildWebStorage(sessionStorage);
*
* const myStorage = new Storage();
* const fromMyStorage = buildWebStorage(myStorage);
* ```
*
* @param storage The type of web storage to use. localStorage or sessionStorage.
* @param prefix The prefix to index the storage. Useful to prevent collision between
*   multiple places using the same storage.
* @param {number} maxStaleAge The maximum age in milliseconds a stale entry can stay
*   in the storage before being removed. Otherwise, stale-able entries would stay
*   indefinitely, eventually causing a memory leak. 1 hour (3_600_000) is default
*/ function buildWebStorage(storage, prefix = "axios-cache-", maxStaleAge = 36e5) {
    function save(key, value) {
        storage.setItem(prefix + key, JSON.stringify(value));
    }
    return buildStorage({
        clear: ()=>{
            for(const key in storage)if (key.startsWith(prefix)) storage.removeItem(key);
        },
        find: (key)=>{
            const json = storage.getItem(prefix + key);
            return json ? JSON.parse(json) : void 0;
        },
        remove: (key)=>{
            storage.removeItem(prefix + key);
        },
        set: (key, value)=>{
            const result = __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$try$2f$lib$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Result"].try(save, key, value);
            if (result.ok) return;
            if (!isDomQuotaExceededError(result.error)) throw result.error;
            const allValues = Object.entries(storage).filter(([key])=>key.startsWith(prefix)).map(([key, value])=>[
                    key,
                    JSON.parse(value)
                ]);
            for (const [key, value] of allValues)if (canRemoveStorageEntry(value, maxStaleAge)) storage.removeItem(key);
            const retry = __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$try$2f$lib$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Result"].try(save, key, value);
            if (retry.ok) return;
            if (!isDomQuotaExceededError(retry.error)) throw retry.error;
            const descItems = allValues.sort((a, b)=>(a[1].createdAt || 0) - (b[1].createdAt || 0));
            for (const item of descItems){
                storage.removeItem(item[0]);
                const lastTry = __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$try$2f$lib$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Result"].try(save, key, value);
                if (lastTry.ok) return;
                if (!isDomQuotaExceededError(lastTry.error)) throw lastTry.error;
            }
        }
    });
}
function isDomQuotaExceededError(error) {
    if (typeof error !== "object" || error === null || !("name" in error)) return false;
    return error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED" || error.name === "QUOTA_EXCEEDED_ERR";
}
;
}),
"[project]/central-auth/node_modules/cache-parser/dist/index.mjs [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "isCacheControl",
    ()=>s,
    "parse",
    ()=>o,
    "tokenize",
    ()=>i
]);
var e = Symbol("cache-parser");
function r(e, r) {
    (null == r || r > e.length) && (r = e.length);
    for(var t = 0, a = Array(r); t < r; t++)a[t] = e[t];
    return a;
}
function t(e) {
    return ("string" == typeof e || "number" == typeof e) && (e = Number(e)) >= 0 && e < Number.POSITIVE_INFINITY;
}
function a(e) {
    return !0 === e || "number" == typeof e || "string" == typeof e && "false" !== e;
}
var n = Number;
function o(o) {
    var i = Object.defineProperty({}, e, {
        enumerable: !1,
        value: 1
    });
    if (!o || "string" != typeof o) return i;
    var s = function(e) {
        for(var t, a = {}, n = function(e) {
            var t = "undefined" != typeof Symbol && e[Symbol.iterator] || e["@@iterator"];
            if (t) return (t = t.call(e)).next.bind(t);
            if (Array.isArray(e) || (t = function(e, t) {
                if (e) {
                    if ("string" == typeof e) return r(e, t);
                    var a = ({}).toString.call(e).slice(8, -1);
                    return "Object" === a && e.constructor && (a = e.constructor.name), "Map" === a || "Set" === a ? Array.from(e) : "Arguments" === a || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(a) ? r(e, t) : void 0;
                }
            }(e))) {
                t && (e = t);
                var a = 0;
                return function() {
                    return a >= e.length ? {
                        done: !0
                    } : {
                        done: !1,
                        value: e[a++]
                    };
                };
            }
            throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
        }(e.toLowerCase().replace(/\s+/g, "").split(",")); !(t = n()).done;){
            var o, i = t.value.split("=", 2);
            a[i[0]] = null == (o = i[1]) || o;
        }
        return a;
    }(o), u = s["max-age"], l = s["max-stale"], m = s["min-fresh"], p = s["s-maxage"], f = s["stale-if-error"], c = s["stale-while-revalidate"];
    return a(s.immutable) && (i.immutable = !0), t(u) && (i.maxAge = n(u)), t(l) && (i.maxStale = n(l)), t(m) && (i.minFresh = n(m)), a(s["must-revalidate"]) && (i.mustRevalidate = !0), a(s["must-understand"]) && (i.mustUnderstand = !0), a(s["no-cache"]) && (i.noCache = !0), a(s["no-store"]) && (i.noStore = !0), a(s["no-transform"]) && (i.noTransform = !0), a(s["only-if-cached"]) && (i.onlyIfCached = !0), a(s.private) && (i.private = !0), a(s["proxy-revalidate"]) && (i.proxyRevalidate = !0), a(s.public) && (i.public = !0), t(p) && (i.sMaxAge = n(p)), t(f) && (i.staleIfError = n(f)), t(c) && (i.staleWhileRevalidate = n(c)), i;
}
function i(e) {
    if (!e || "object" != typeof e) return [];
    var r = [];
    return a(e.immutable) && r.push("immutable"), t(e.maxAge) && r.push("max-age=" + e.maxAge), t(e.maxStale) && r.push("max-stale=" + e.maxStale), t(e.minFresh) && r.push("min-fresh=" + e.minFresh), a(e.mustRevalidate) && r.push("must-revalidate"), a(e.mustUnderstand) && r.push("must-understand"), a(e.noCache) && r.push("no-cache"), a(e.noStore) && r.push("no-store"), a(e.noTransform) && r.push("no-transform"), a(e.onlyIfCached) && r.push("only-if-cached"), a(e.private) && r.push("private"), a(e.proxyRevalidate) && r.push("proxy-revalidate"), a(e.public) && r.push("public"), t(e.sMaxAge) && r.push("s-maxage=" + e.sMaxAge), t(e.staleIfError) && r.push("stale-if-error=" + e.staleIfError), t(e.staleWhileRevalidate) && r.push("stale-while-revalidate=" + e.staleWhileRevalidate), r;
}
function s(r) {
    return !!r && !!r[e];
}
;
}),
"[project]/central-auth/node_modules/call-bind-apply-helpers/actualApply.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var bind = __turbopack_context__.r("[project]/central-auth/node_modules/function-bind/index.js [app-route] (ecmascript)");
var $apply = __turbopack_context__.r("[project]/central-auth/node_modules/call-bind-apply-helpers/functionApply.js [app-route] (ecmascript)");
var $call = __turbopack_context__.r("[project]/central-auth/node_modules/call-bind-apply-helpers/functionCall.js [app-route] (ecmascript)");
var $reflectApply = __turbopack_context__.r("[project]/central-auth/node_modules/call-bind-apply-helpers/reflectApply.js [app-route] (ecmascript)");
/** @type {import('./actualApply')} */ module.exports = $reflectApply || bind.call($call, $apply);
}),
"[project]/central-auth/node_modules/call-bind-apply-helpers/functionApply.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('./functionApply')} */ module.exports = Function.prototype.apply;
}),
"[project]/central-auth/node_modules/call-bind-apply-helpers/functionCall.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('./functionCall')} */ module.exports = Function.prototype.call;
}),
"[project]/central-auth/node_modules/call-bind-apply-helpers/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var bind = __turbopack_context__.r("[project]/central-auth/node_modules/function-bind/index.js [app-route] (ecmascript)");
var $TypeError = __turbopack_context__.r("[project]/central-auth/node_modules/es-errors/type.js [app-route] (ecmascript)");
var $call = __turbopack_context__.r("[project]/central-auth/node_modules/call-bind-apply-helpers/functionCall.js [app-route] (ecmascript)");
var $actualApply = __turbopack_context__.r("[project]/central-auth/node_modules/call-bind-apply-helpers/actualApply.js [app-route] (ecmascript)");
/** @type {(args: [Function, thisArg?: unknown, ...args: unknown[]]) => Function} TODO FIXME, find a way to use import('.') */ module.exports = function callBindBasic(args) {
    if (args.length < 1 || typeof args[0] !== 'function') {
        throw new $TypeError('a function is required');
    }
    return $actualApply(bind, $call, args);
};
}),
"[project]/central-auth/node_modules/call-bind-apply-helpers/reflectApply.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('./reflectApply')} */ module.exports = typeof Reflect !== 'undefined' && Reflect && Reflect.apply;
}),
"[project]/central-auth/node_modules/centralauth/src/server.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CentralAuthClass",
    ()=>CentralAuthClass,
    "CentralAuthHTTPClass",
    ()=>CentralAuthHTTPClass,
    "ValidationError",
    ()=>ValidationError,
    "canStale",
    ()=>canStale,
    "hash",
    ()=>hash
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$axios$2f$lib$2f$axios$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/axios/lib/axios.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$axios$2d$cache$2d$interceptor$2f$dist$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/axios-cache-interceptor/dist/index.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$jwt$2f$decrypt$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/jose/dist/webapi/jwt/decrypt.js [app-route] (ecmascript)");
var __awaiter = ("TURBOPACK compile-time value", void 0) && ("TURBOPACK compile-time value", void 0).__awaiter || function(thisArg, _arguments, P, generator) {
    function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
            resolve(value);
        });
    }
    return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
            try {
                step(generator.next(value));
            } catch (e) {
                reject(e);
            }
        }
        function rejected(value) {
            try {
                step(generator["throw"](value));
            } catch (e) {
                reject(e);
            }
        }
        function step(result) {
            result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
;
;
;
const canStale = __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$axios$2d$cache$2d$interceptor$2f$dist$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["canStale"];
//Private method for parsing a cookie string in a request header
const parseCookie = (cookieString)=>(cookieString === null || cookieString === void 0 ? void 0 : cookieString.split(';').map((v)=>v.split('=')).reduce((acc, v)=>{
        acc[decodeURIComponent(v[0].trim())] = decodeURIComponent(v[1].trim());
        return acc;
    }, {})) || {};
class ValidationError extends Error {
    constructor(error){
        super(error.message);
        this.errorCode = error.errorCode;
    }
}
const hash = (string)=>__awaiter(void 0, void 0, void 0, function*() {
        const textEncoder = new TextEncoder();
        const encodedString = textEncoder.encode(string);
        const encodedHash = yield crypto.subtle.digest("SHA-256", encodedString);
        const base64Hash = Buffer.from(encodedHash).toString("base64url");
        return base64Hash;
    });
class CentralAuthClass {
    //Constructor method to set all instance variable
    constructor({ clientId, secret, authBaseUrl, callbackUrl, debug, cache, unsafeIncludeUser }){
        //Instantiate the Axios cache interceptor
        this.instance = __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$axios$2f$lib$2f$axios$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].create();
        //Private method to check whether all variable are set for a specific action
        //Will throw a ValidationError when a check fails
        this.checkData = (action)=>{
            let error = null;
            if (typeof this.clientId === "undefined") error = {
                errorCode: "organizationIdMissing",
                message: "The organization ID is missing. This ID can be found on the organization page in your admin console."
            };
            if (!this.secret) error = {
                errorCode: "secretMissing",
                message: "The secret is missing. The secret is shown only once at the creation of an organization and should never be exposed publicly or stored unsafely."
            };
            if (!this.callbackUrl) error = {
                errorCode: "callbackUrlMissing",
                message: "The callback URL is missing."
            };
            if (!this.authBaseUrl) error = {
                errorCode: "authBaseUrlMissing",
                message: "The base URL for the organization is missing. The base URL is either the internal base URL or a custom domain for your organization."
            };
            if ((action == "callback" || action == "verify") && !this.token) error = {
                errorCode: "tokenMissing",
                message: "The JSON Web Token is missing. A JWT must be created in the callback after a successful login attempt."
            };
            if (action == "user" && !this.token) error = {
                errorCode: "tokenMissing",
                message: "The JSON Web Token is missing. This means the user is not logged in or the token is invalid."
            };
            if (error) {
                if (this.debug) console.log(`[CENTRALAUTH DEBUG] Data check failed for client ${this.clientId || "CentralAuth"} in ${action}: ${error.message}`);
                throw new ValidationError(error);
            }
        };
        //Private method to populate the token, either from the cookie of the token bearer in the headers
        this.populateToken = (headers)=>__awaiter(this, void 0, void 0, function*() {
                const authHeader = headers.get("Authorization");
                if (authHeader) yield this.setTokenFromTokenBearer(headers);
                else yield this.setTokenFromCookie(headers);
            });
        //Private method to get the decoded token
        //Can only be used after the token has been set in this object
        this.getDecodedToken = ()=>__awaiter(this, void 0, void 0, function*() {
                try {
                    //Decode the JWT
                    const textEncoder = new TextEncoder();
                    const { payload: decodedToken } = yield (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$jwt$2f$decrypt$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["jwtDecrypt"])(this.token, textEncoder.encode(this.secret));
                    return decodedToken;
                } catch (error) {
                    if (this.debug) console.log(`[CENTRALAUTH DEBUG] Failed to decode token for client ${this.clientId || "CentralAuth"}: ${error.message}`, `Token: ${this.token}`);
                    throw new ValidationError({
                        errorCode: error === null || error === void 0 ? void 0 : error.name,
                        message: error === null || error === void 0 ? void 0 : error.message
                    });
                }
            });
        //Private method to get the returnTo URL from the config object or current request
        this.getReturnToURL = (req, config)=>{
            const url = new URL(req.url);
            const returnToParam = url.searchParams.get("return_to");
            const headers = req.headers;
            let returnTo = "";
            //Set returnTo when explicitly given in the config object
            if (config === null || config === void 0 ? void 0 : config.returnTo) returnTo = config.returnTo;
            else if (returnToParam) returnTo = returnToParam; //Set returnTo to any returnTo query param in the URL
            else {
                const referrer = headers.get("referer");
                //Set returnTo to the referrer in the request when present
                if (referrer && !referrer.startsWith("about") && referrer != this.authBaseUrl) returnTo = referrer;
                else {
                    //Otherwise fallback to the origin
                    returnTo = new URL(req.url).origin;
                }
            }
            return returnTo;
        };
        //Private method to return the client user agent from request headers
        this.getUserAgent = (headers)=>{
            const userAgent = headers.get("user-agent");
            return userAgent || "native";
        };
        //Private method to return the client IP address from request headers
        this.getIPAddress = (headers)=>{
            const authIp = headers.get("auth-ip");
            const realIp = headers.get("x-real-ip");
            const forwardedFor = headers.get("x-forwarded-for");
            const ip = authIp || forwardedFor || realIp || null;
            //The IP address might consist of multiple IP addresses, seperated by commas. Only return the first IP address
            return ip ? ip.split(",")[0] : "0.0.0.0";
        };
        //Private method to get the (cached) user data from the ID token or the CentralAuth server
        //To get the user data directly from the CentralAuth server, use the getUserFromServer method
        //Saves the user data in this object when fetched from the server to prevent multiple calls to the server in the same session
        this.getUser = (headers)=>__awaiter(this, void 0, void 0, function*() {
                if (this.userData) return this.userData;
                else {
                    if (!this.token) return null;
                    //Get the decoded token
                    const jwtPayload = yield this.getDecodedToken();
                    const { user } = jwtPayload;
                    this.checkData("user");
                    if (this.unsafeIncludeUser && user) this.userData = user;
                    else {
                        this.userData = yield this.getUserFromServer(headers, this.token);
                    }
                }
            });
        //Private method to get the user data from the CentralAuth server
        //Will throw an error when the request fails
        //Returns the user data, but doesn't save it in this object
        this.getUserFromServer = (headers, token)=>__awaiter(this, void 0, void 0, function*() {
                var _a;
                //Get the IP address and user agent from the headers
                const ipAddress = this.getIPAddress(headers);
                const userAgent = this.getUserAgent(headers);
                //Get the device ID from the headers if set (only used for native apps)
                const deviceId = headers.get("device-id");
                //Get the user and session data from the CentralAuth server
                const requestHeaders = {
                    "Content-Type": "text/plain",
                    "Authorization": `Basic ${Buffer.from(`${this.clientId || ""}:${this.secret}`).toString("base64")}`,
                    "user-agent": userAgent,
                    "auth-ip": ipAddress //Set the custom auth-ip header with the IP address of the current request
                };
                //Set the device ID header if present
                if (deviceId) requestHeaders["device-id"] = deviceId;
                //Construct the URL
                const requestUrl = new URL(`${this.authBaseUrl}/api/v1/userinfo`);
                const callbackUrl = new URL(this.callbackUrl);
                requestUrl.searchParams.set("domain", callbackUrl.origin);
                try {
                    const response = yield this.axios.post(requestUrl.toString(), token, {
                        headers: requestHeaders
                    });
                    return response.data;
                } catch (error) {
                    const errorData = (_a = error.response) === null || _a === void 0 ? void 0 : _a.data;
                    if (this.debug) console.log(`[CENTRALAUTH DEBUG] Failed to fetch user data from the server for client ${this.clientId || "CentralAuth"}: ${(errorData === null || errorData === void 0 ? void 0 : errorData.message) || error.message}`);
                    throw new ValidationError(errorData || {
                        errorCode: "networkError",
                        message: error.message
                    });
                }
            });
        //Private method to populate the token argument from the cookie in the session
        this.setTokenFromCookie = (headers)=>__awaiter(this, void 0, void 0, function*() {
                const cookies = parseCookie(headers.get("cookie"));
                //Check for a access_token or id_token in the cookies based on the unsafeIncludeUser flag
                if (this.unsafeIncludeUser && cookies["id_token"]) this.token = cookies["id_token"];
                else this.token = cookies["access_token"];
            });
        //Private method to populate the token argument from the JWT in the token bearer header
        this.setTokenFromTokenBearer = (headers)=>__awaiter(this, void 0, void 0, function*() {
                const authHeader = headers.get("Authorization");
                //Check for a token bearer header
                if (authHeader && authHeader.startsWith("Bearer ")) this.token = authHeader.substring(7);
            });
        //Public method to get the user data from the current request headers
        //The JWT will be set based on the cookie or token bearer in the request header
        //Will throw an error when the request fails or the token could not be decoded
        this.getUserData = (headers)=>__awaiter(this, void 0, void 0, function*() {
                //Get the user data from cache or CentralAuth
                yield this.populateToken(headers);
                yield this.getUser(headers);
                return this.userData || null;
            });
        //Public method to get an HTML snippet for embedding the login form
        //The login form will be embedded in an iframe with the given login URL
        this.getEmbedScript = (loginPath, returnPath)=>{
            const callbackUrl = new URL(this.callbackUrl);
            const srcUrl = new URL(`${callbackUrl.origin}${loginPath}`);
            srcUrl.searchParams.set("embed", "1");
            //Construct the return URL and set it in the src URL
            const returnUrl = new URL(`${callbackUrl.origin}${returnPath}`);
            srcUrl.searchParams.set("return_to", returnUrl.toString());
            const script = `const iframe = document.createElement("iframe");
iframe.id = "centralauth-embedded-login";
iframe.scrolling = "no";
iframe.src = "${srcUrl.toString()}";
iframe.allow = "publickey-credentials-get *; publickey-credentials-create *";
iframe.referrerpolicy = "origin";
iframe.style = "width:420px;outline:none;border:none";
document.getElementById("centralauth-login-form").innerHTML = iframe.outerHTML;
window.addEventListener("message", ({data}) => document.getElementById("centralauth-embedded-login").style.height = data + "px");`;
            return script;
        };
        //Public method to start a direct authentication procedure based on a given email address
        //Will throw an error when the procedure could not be started
        this.authenticateDirect = (req, config)=>__awaiter(this, void 0, void 0, function*() {
                this.checkData("login");
                const returnTo = this.getReturnToURL(req, config);
                const callbackUrl = new URL(this.callbackUrl);
                if (returnTo) callbackUrl.searchParams.set("return_to", returnTo);
                //Set the body for the direct authentication request
                const body = {
                    email: config.email,
                    state: config.state || crypto.randomUUID(),
                    redirect_uri: callbackUrl.toString(),
                    translations: config.translations
                };
                //Set the headers for the direct authentication request
                const headers = new Headers();
                headers.set("Content-Type", "application/json");
                headers.set("Authorization", `Basic ${Buffer.from(`${this.clientId || ""}:${this.secret}`).toString("base64")}`);
                const authenticationResponse = yield fetch(`${this.authBaseUrl}/api/v1/authenticate_direct`, {
                    method: "POST",
                    body: JSON.stringify(body),
                    headers
                });
                if (!authenticationResponse.ok) {
                    const error = yield authenticationResponse.json();
                    throw new ValidationError(error);
                }
                const responseData = yield authenticationResponse.json();
                return responseData;
            });
        //Public method to start the login procedure
        //Will throw an error when the procedure could not be started
        this.login = (req, config)=>__awaiter(this, void 0, void 0, function*() {
                this.checkData("login");
                const returnTo = this.getReturnToURL(req, config);
                const callbackUrl = new URL(this.callbackUrl);
                if (returnTo) callbackUrl.searchParams.set("return_to", returnTo);
                //Construct the base URL for the OAuth login
                const authorizationUriParams = {
                    redirect_uri: callbackUrl.toString()
                };
                //Add the client ID when given
                if (this.clientId) authorizationUriParams.client_id = this.clientId;
                //Add the response type, which is always "code"
                authorizationUriParams.response_type = "code";
                //Add an error message when given
                if (config === null || config === void 0 ? void 0 : config.errorMessage) authorizationUriParams.error_description = config.errorMessage;
                //Add a default email address when given
                if (config === null || config === void 0 ? void 0 : config.email) authorizationUriParams.email = config.email;
                //Add OAuth state when given, otherwise fall back to a random state
                authorizationUriParams.state = (config === null || config === void 0 ? void 0 : config.state) || crypto.randomUUID();
                //Add translations when given
                if (config === null || config === void 0 ? void 0 : config.translations) authorizationUriParams.translations = Buffer.from(JSON.stringify(config.translations)).toString("base64");
                //Add theme settings when given
                if (config === null || config === void 0 ? void 0 : config.themeSettings) authorizationUriParams.theme_settings = Buffer.from(JSON.stringify(config.themeSettings)).toString("base64");
                //Add embed boolean when given
                if (config === null || config === void 0 ? void 0 : config.embed) authorizationUriParams.embed = "1";
                //Add affirmExistingSession boolean when given
                if (config === null || config === void 0 ? void 0 : config.affirmExistingSession) authorizationUriParams.affirm = "1";
                //Set the code verifier to a random UUID and calculate the SHA256 hash as code challenge
                //Store the code verifier in the cookie and set the code challenge as URI param to the login page
                const codeVerifier = crypto.randomUUID();
                const codeChallenge = yield hash(codeVerifier);
                authorizationUriParams.code_challenge = codeChallenge;
                authorizationUriParams.code_challenge_method = "S256";
                const authorizationUri = new URL(`${this.authBaseUrl}/login`);
                //Set the search parameters for the authorization URI
                for (const [key, value] of Object.entries(authorizationUriParams))authorizationUri.searchParams.set(key, value);
                if (this.debug) console.log(`[CENTRALAUTH DEBUG] Starting login procedure for client ${this.clientId || "CentralAuth"}, redirecting to ${authorizationUri.toString()}.`);
                //Set the code verifier in the cookies and redirect user to the authorization URI
                return new Response(null, {
                    status: 302,
                    headers: {
                        "Location": authorizationUri.toString(),
                        "Set-Cookie": `code_verifier=${codeVerifier}; Path=/; HttpOnly; Max-Age=3600; SameSite=Lax; Secure`
                    }
                });
            });
        //Public method for the callback procedure when returning from CentralAuth
        this.callback = (req, config)=>__awaiter(this, void 0, void 0, function*() {
                const res = yield this.processCallback(req, config === null || config === void 0 ? void 0 : config.onStateReceived);
                //When an onAfterCallback function is given, call it with the user data
                //The onAfterCallback function may return a new/altered response, which will be returned instead of the default response object
                let callbackResponse = null;
                if (config === null || config === void 0 ? void 0 : config.onAfterCallback) callbackResponse = yield config.onAfterCallback(req, res, this.userData);
                //Set a cookie with the JWT and redirect to the returnTo URL
                return callbackResponse || res;
            });
        //Protected method for processing the callback
        //This method will process the OAuth code and verify the user session with it
        //The user object will be retrieved based on the returned access JWT
        //Optionally calls a custom callback function when given with the user object as an argument
        //Returns a Response with a redirection to the returnTo URL
        //Will throw an error when the verification procedure fails or the user object could not be fetched
        this.processCallback = (req, onStateReceived)=>__awaiter(this, void 0, void 0, function*() {
                const url = new URL(req.url);
                const headerList = req.headers;
                const searchParams = url.searchParams;
                const returnTo = searchParams.get("return_to") || url.origin;
                const sessionId = searchParams.get("code");
                const state = searchParams.get("state");
                const errorCode = searchParams.get("error");
                const errorMessage = searchParams.get("error_description");
                const affirmExistingSession = searchParams.get("affirm") === "1";
                //If the affirmExistingSession parameter is set to true, it means the user has an existing session and needs to be affirmed to continue
                //Get the current user data based on the token in the cookie and compare it to the affirmed user data later in the callback
                const existingUserData = affirmExistingSession ? yield this.getUserData(req.headers) : null;
                //Get the code verifier from the cookies
                const cookies = parseCookie(headerList.get("cookie"));
                const codeVerifier = cookies["code_verifier"];
                //If the state is given and an onStateReceived function is given, call it to verify the state
                if (state && onStateReceived) {
                    const stateVerification = yield onStateReceived(req, state);
                    if (!stateVerification) {
                        if (this.debug) console.log(`[CENTRALAUTH DEBUG] State verification failed for client ${this.clientId || "CentralAuth"}`);
                        throw new ValidationError({
                            errorCode: "stateInvalid",
                            message: "State verification failed."
                        });
                    }
                }
                if (errorCode || errorMessage) {
                    //When the error code is set, something went wrong in the login procedure
                    //Throw a ValidationError
                    if (this.debug) console.log(`[CENTRALAUTH DEBUG] Error in login procedure for client ${this.clientId || "CentralAuth"}: ${errorMessage}`);
                    throw new ValidationError({
                        errorCode: errorCode,
                        message: errorMessage || ""
                    });
                }
                if (!sessionId) {
                    if (this.debug) console.log(`[CENTRALAUTH DEBUG] Callback could not be processed for client ${this.clientId || "CentralAuth"}, missing code.`);
                    throw new ValidationError({
                        errorCode: "missingFields",
                        message: "The code is missing in the callback URL."
                    });
                }
                //Get an access JWT based on the given code
                const headers = new Headers();
                headers.set("Authorization", `Basic ${Buffer.from(`${this.clientId || ""}:${this.secret}`).toString("base64")}`);
                const formData = new FormData();
                formData.append("code", sessionId);
                formData.append("redirect_uri", this.callbackUrl);
                formData.append("code_verifier", codeVerifier);
                const tokenObject = yield fetch(`${this.authBaseUrl}/api/v1/verify`, {
                    method: "POST",
                    body: formData,
                    headers
                });
                if (!tokenObject.ok) {
                    const error = yield tokenObject.json();
                    throw new ValidationError(error);
                }
                //Parse the token response
                const tokenResponse = yield tokenObject.json();
                //Set the token in this object based on the unsafeIncludeUser flag
                const newToken = this.unsafeIncludeUser ? tokenResponse.id_token : tokenResponse.access_token;
                //When affirmExistingSession is true, compare the existing user data with the new user data after login
                if (affirmExistingSession) {
                    //Get the new user data without setting it in this object yet
                    const newUserData = yield this.getUserFromServer(req.headers, newToken);
                    //If the email address in the existing user data is different from the email address in the new user data, it means a different user has logged in and the session should not be continued
                    if ((existingUserData === null || existingUserData === void 0 ? void 0 : existingUserData.email) !== newUserData.email) throw new ValidationError({
                        errorCode: "sessionInvalid",
                        message: "Affirmed user is not the same as the currently logged in user."
                    });
                }
                this.token = newToken;
                this.checkData("verify");
                //Populate the user data based on the token
                yield this.getUser(req.headers);
                //Set the response object with the redirect and the cookies
                const newHeaders = new Headers();
                newHeaders.append("Location", returnTo);
                newHeaders.append("Set-Cookie", `${this.unsafeIncludeUser ? "id_token" : "access_token"}=${this.token}; Path=/; HttpOnly; Max-Age=${typeof tokenResponse.expires_in == "number" ? tokenResponse.expires_in : 31536000}; SameSite=Lax; Secure`);
                newHeaders.append("Set-Cookie", `code_verifier= ; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax; Secure`);
                let res = new Response(null, {
                    status: 302,
                    headers: newHeaders
                });
                //Set a cookie with the JWT and redirect to the returnTo URL
                return res;
            });
        //Public method to get the user data from the current request headers
        //This method wraps getUserData and returns a Response with the user data as JSON in the body
        //Will return a NULL response on error
        this.user = (headers)=>__awaiter(this, void 0, void 0, function*() {
                try {
                    yield this.getUserData(headers);
                    //Return the user data as JSON
                    return Response.json(this.userData);
                } catch (error) {
                    //When an error occurs, assume the user session is not valid anymore
                    //Delete the cookie
                    if (this.debug) console.log(`[CENTRALAUTH DEBUG] Error fetching user data from cache or CentralAuth server or validation error for client ${this.clientId || "CentralAuth"}: ${error === null || error === void 0 ? void 0 : error.message}`);
                    return Response.json(null, {
                        headers: {
                            "Set-Cookie": `${this.unsafeIncludeUser ? "id_token" : "access_token"}= ; Path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax; Secure`
                        }
                    });
                }
            });
        //Public method to logout
        this.logout = (req, config)=>__awaiter(this, void 0, void 0, function*() {
                const returnTo = this.getReturnToURL(req, config);
                const headerList = req.headers;
                try {
                    if (config === null || config === void 0 ? void 0 : config.logoutSessionWide) {
                        //Populate the token in this object
                        yield this.populateToken(headerList);
                        //To log out session wide, invalidate the session at CentralAuth
                        const headers = new Headers();
                        headers.set("Content-Type", "text/plain");
                        headers.set("Authorization", `Basic ${Buffer.from(`${this.clientId || ""}:${this.secret}`).toString("base64")}`);
                        const logoutResponse = yield fetch(`${this.authBaseUrl}/api/v1/logout`, {
                            method: "POST",
                            body: this.token,
                            headers
                        });
                        if (!logoutResponse.ok) {
                            const error = yield logoutResponse.json();
                            throw new ValidationError(error);
                        }
                    }
                } catch (error) {
                    if (this.debug) console.log(`[CENTRALAUTH DEBUG] Error logging out session-wide for client ${this.clientId || "CentralAuth"}: ${error === null || error === void 0 ? void 0 : error.message}`);
                } finally{
                    //Unset the cookie and redirect to the returnTo URL
                    return new Response(null, {
                        status: 302,
                        headers: {
                            "Location": returnTo,
                            "Set-Cookie": `${this.unsafeIncludeUser ? "id_token" : "access_token"}= ; Path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax; Secure`
                        }
                    });
                }
            });
        this.clientId = clientId;
        this.secret = secret;
        this.authBaseUrl = authBaseUrl;
        this.callbackUrl = callbackUrl;
        this.debug = debug;
        this.cache = cache;
        this.axios = (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$axios$2d$cache$2d$interceptor$2f$dist$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["setupCache"])(this.instance, {
            methods: [
                'get',
                'post'
            ],
            ttl: (cache === null || cache === void 0 ? void 0 : cache.ttl) || 0,
            storage: cache ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$axios$2d$cache$2d$interceptor$2f$dist$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["buildStorage"])(cache.storage) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$axios$2d$cache$2d$interceptor$2f$dist$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["buildMemoryStorage"])()
        });
        if (unsafeIncludeUser) {
            this.unsafeIncludeUser = true;
            console.log(`[CENTRALAUTH DEBUG] Unsafe ID token will be used for ${clientId || "CentralAuth"}.`);
        }
    }
}
class CentralAuthHTTPClass extends CentralAuthClass {
    constructor(){
        super(...arguments);
        //Private method for converting a HTTP Request to a Fetch API Request
        this.httpRequestToFetchRequest = (httpRequest)=>{
            const baseUrl = new URL(this.callbackUrl);
            const fetchRequest = new Request(new URL(httpRequest.url, baseUrl.origin), {
                headers: new Headers(Object.assign({}, httpRequest.headers))
            });
            return fetchRequest;
        };
        //Private method for converting a Fetch API response to an HTTP Response
        this.fetchResponseToHttpResponse = (fetchResponse, httpResponse)=>__awaiter(this, void 0, void 0, function*() {
                var _a, _b;
                //Handle Set-Cookie headers separately since they can have multiple values
                const setCookieHeaders = ((_b = (_a = fetchResponse.headers).getSetCookie) === null || _b === void 0 ? void 0 : _b.call(_a)) || [];
                //Set all other headers
                const entries = fetchResponse.headers.entries();
                for (const [key, value] of entries){
                    if (key.toLowerCase() !== 'set-cookie') {
                        httpResponse.setHeader(key, value);
                    }
                }
                //Set all Set-Cookie headers
                if (setCookieHeaders.length > 0) {
                    httpResponse.setHeader('Set-Cookie', setCookieHeaders);
                }
                const body = yield fetchResponse.text();
                httpResponse.writeHead(fetchResponse.status).end(body);
            });
        //Overloaded method for getUserData
        this.getUserDataHTTP = (req)=>__awaiter(this, void 0, void 0, function*() {
                const request = this.httpRequestToFetchRequest(req);
                return yield this.getUserData(request.headers);
            });
        //Overloaded method for direct authentication
        this.authenticateDirectHTTP = (req, config)=>__awaiter(this, void 0, void 0, function*() {
                return yield this.authenticateDirect(this.httpRequestToFetchRequest(req), config);
            });
        //Overloaded method for login
        this.loginHTTP = (req, res, config)=>__awaiter(this, void 0, void 0, function*() {
                const fetchResponse = yield this.login(this.httpRequestToFetchRequest(req), config);
                yield this.fetchResponseToHttpResponse(fetchResponse, res);
            });
        //Overloaded method for callback
        this.callbackHTTP = (req, res, config)=>__awaiter(this, void 0, void 0, function*() {
                const fetchResponse = yield this.processCallback(this.httpRequestToFetchRequest(req), config === null || config === void 0 ? void 0 : config.onStateReceived);
                //When an onAfterCallback function is given, call it with the user data
                //The onAfterCallback function may return a new/altered response, which will be returned instead of the default response object
                let callbackResponse = null;
                if (config === null || config === void 0 ? void 0 : config.onAfterCallback) callbackResponse = yield config.onAfterCallback(req, res, fetchResponse, this.userData);
                yield this.fetchResponseToHttpResponse(callbackResponse || fetchResponse, res);
            });
        //Overloaded method for logout
        this.logoutHTTP = (req, res, config)=>__awaiter(this, void 0, void 0, function*() {
                const fetchResponse = yield this.logout(this.httpRequestToFetchRequest(req), config);
                yield this.fetchResponseToHttpResponse(fetchResponse, res);
            });
        //Overloaded method for user
        this.userHTTP = (req, res)=>__awaiter(this, void 0, void 0, function*() {
                const fetchResponse = yield this.user(this.httpRequestToFetchRequest(req).headers);
                yield this.fetchResponseToHttpResponse(fetchResponse, res);
            });
    }
}
}),
"[project]/central-auth/node_modules/combined-stream/lib/combined_stream.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

var util = __turbopack_context__.r("[externals]/util [external] (util, cjs)");
var Stream = __turbopack_context__.r("[externals]/stream [external] (stream, cjs)").Stream;
var DelayedStream = __turbopack_context__.r("[project]/central-auth/node_modules/delayed-stream/lib/delayed_stream.js [app-route] (ecmascript)");
module.exports = CombinedStream;
function CombinedStream() {
    this.writable = false;
    this.readable = true;
    this.dataSize = 0;
    this.maxDataSize = 2 * 1024 * 1024;
    this.pauseStreams = true;
    this._released = false;
    this._streams = [];
    this._currentStream = null;
    this._insideLoop = false;
    this._pendingNext = false;
}
util.inherits(CombinedStream, Stream);
CombinedStream.create = function(options) {
    var combinedStream = new this();
    options = options || {};
    for(var option in options){
        combinedStream[option] = options[option];
    }
    return combinedStream;
};
CombinedStream.isStreamLike = function(stream) {
    return typeof stream !== 'function' && typeof stream !== 'string' && typeof stream !== 'boolean' && typeof stream !== 'number' && !Buffer.isBuffer(stream);
};
CombinedStream.prototype.append = function(stream) {
    var isStreamLike = CombinedStream.isStreamLike(stream);
    if (isStreamLike) {
        if (!(stream instanceof DelayedStream)) {
            var newStream = DelayedStream.create(stream, {
                maxDataSize: Infinity,
                pauseStream: this.pauseStreams
            });
            stream.on('data', this._checkDataSize.bind(this));
            stream = newStream;
        }
        this._handleErrors(stream);
        if (this.pauseStreams) {
            stream.pause();
        }
    }
    this._streams.push(stream);
    return this;
};
CombinedStream.prototype.pipe = function(dest, options) {
    Stream.prototype.pipe.call(this, dest, options);
    this.resume();
    return dest;
};
CombinedStream.prototype._getNext = function() {
    this._currentStream = null;
    if (this._insideLoop) {
        this._pendingNext = true;
        return; // defer call
    }
    this._insideLoop = true;
    try {
        do {
            this._pendingNext = false;
            this._realGetNext();
        }while (this._pendingNext)
    } finally{
        this._insideLoop = false;
    }
};
CombinedStream.prototype._realGetNext = function() {
    var stream = this._streams.shift();
    if (typeof stream == 'undefined') {
        this.end();
        return;
    }
    if (typeof stream !== 'function') {
        this._pipeNext(stream);
        return;
    }
    var getStream = stream;
    getStream((function(stream) {
        var isStreamLike = CombinedStream.isStreamLike(stream);
        if (isStreamLike) {
            stream.on('data', this._checkDataSize.bind(this));
            this._handleErrors(stream);
        }
        this._pipeNext(stream);
    }).bind(this));
};
CombinedStream.prototype._pipeNext = function(stream) {
    this._currentStream = stream;
    var isStreamLike = CombinedStream.isStreamLike(stream);
    if (isStreamLike) {
        stream.on('end', this._getNext.bind(this));
        stream.pipe(this, {
            end: false
        });
        return;
    }
    var value = stream;
    this.write(value);
    this._getNext();
};
CombinedStream.prototype._handleErrors = function(stream) {
    var self = this;
    stream.on('error', function(err) {
        self._emitError(err);
    });
};
CombinedStream.prototype.write = function(data) {
    this.emit('data', data);
};
CombinedStream.prototype.pause = function() {
    if (!this.pauseStreams) {
        return;
    }
    if (this.pauseStreams && this._currentStream && typeof this._currentStream.pause == 'function') this._currentStream.pause();
    this.emit('pause');
};
CombinedStream.prototype.resume = function() {
    if (!this._released) {
        this._released = true;
        this.writable = true;
        this._getNext();
    }
    if (this.pauseStreams && this._currentStream && typeof this._currentStream.resume == 'function') this._currentStream.resume();
    this.emit('resume');
};
CombinedStream.prototype.end = function() {
    this._reset();
    this.emit('end');
};
CombinedStream.prototype.destroy = function() {
    this._reset();
    this.emit('close');
};
CombinedStream.prototype._reset = function() {
    this.writable = false;
    this._streams = [];
    this._currentStream = null;
};
CombinedStream.prototype._checkDataSize = function() {
    this._updateDataSize();
    if (this.dataSize <= this.maxDataSize) {
        return;
    }
    var message = 'DelayedStream#maxDataSize of ' + this.maxDataSize + ' bytes exceeded.';
    this._emitError(new Error(message));
};
CombinedStream.prototype._updateDataSize = function() {
    this.dataSize = 0;
    var self = this;
    this._streams.forEach(function(stream) {
        if (!stream.dataSize) {
            return;
        }
        self.dataSize += stream.dataSize;
    });
    if (this._currentStream && this._currentStream.dataSize) {
        this.dataSize += this._currentStream.dataSize;
    }
};
CombinedStream.prototype._emitError = function(err) {
    this._reset();
    this.emit('error', err);
};
}),
"[project]/central-auth/node_modules/debug/src/browser.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

/* eslint-env browser */ /**
 * This is the web browser implementation of `debug()`.
 */ exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.storage = localstorage();
exports.destroy = (()=>{
    let warned = false;
    return ()=>{
        if (!warned) {
            warned = true;
            console.warn('Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.');
        }
    };
})();
/**
 * Colors.
 */ exports.colors = [
    '#0000CC',
    '#0000FF',
    '#0033CC',
    '#0033FF',
    '#0066CC',
    '#0066FF',
    '#0099CC',
    '#0099FF',
    '#00CC00',
    '#00CC33',
    '#00CC66',
    '#00CC99',
    '#00CCCC',
    '#00CCFF',
    '#3300CC',
    '#3300FF',
    '#3333CC',
    '#3333FF',
    '#3366CC',
    '#3366FF',
    '#3399CC',
    '#3399FF',
    '#33CC00',
    '#33CC33',
    '#33CC66',
    '#33CC99',
    '#33CCCC',
    '#33CCFF',
    '#6600CC',
    '#6600FF',
    '#6633CC',
    '#6633FF',
    '#66CC00',
    '#66CC33',
    '#9900CC',
    '#9900FF',
    '#9933CC',
    '#9933FF',
    '#99CC00',
    '#99CC33',
    '#CC0000',
    '#CC0033',
    '#CC0066',
    '#CC0099',
    '#CC00CC',
    '#CC00FF',
    '#CC3300',
    '#CC3333',
    '#CC3366',
    '#CC3399',
    '#CC33CC',
    '#CC33FF',
    '#CC6600',
    '#CC6633',
    '#CC9900',
    '#CC9933',
    '#CCCC00',
    '#CCCC33',
    '#FF0000',
    '#FF0033',
    '#FF0066',
    '#FF0099',
    '#FF00CC',
    '#FF00FF',
    '#FF3300',
    '#FF3333',
    '#FF3366',
    '#FF3399',
    '#FF33CC',
    '#FF33FF',
    '#FF6600',
    '#FF6633',
    '#FF9900',
    '#FF9933',
    '#FFCC00',
    '#FFCC33'
];
/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */ // eslint-disable-next-line complexity
function useColors() {
    // NB: In an Electron preload script, document will be defined but not fully
    // initialized. Since we know we're in Chrome, we'll just detect this case
    // explicitly
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    // Internet Explorer and Edge do not support colors.
    if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
        return false;
    }
    let m;
    // Is webkit? http://stackoverflow.com/a/16459606/376773
    // document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
    // eslint-disable-next-line no-return-assign
    return typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || ("TURBOPACK compile-time value", "undefined") !== 'undefined' && window.console && (window.console.firebug || window.console.exception && window.console.table) || typeof navigator !== 'undefined' && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31 || typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
}
/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */ function formatArgs(args) {
    args[0] = (this.useColors ? '%c' : '') + this.namespace + (this.useColors ? ' %c' : ' ') + args[0] + (this.useColors ? '%c ' : ' ') + '+' + module.exports.humanize(this.diff);
    if (!this.useColors) {
        return;
    }
    const c = 'color: ' + this.color;
    args.splice(1, 0, c, 'color: inherit');
    // The final "%c" is somewhat tricky, because there could be other
    // arguments passed either before or after the %c, so we need to
    // figure out the correct index to insert the CSS into
    let index = 0;
    let lastC = 0;
    args[0].replace(/%[a-zA-Z%]/g, (match)=>{
        if (match === '%%') {
            return;
        }
        index++;
        if (match === '%c') {
            // We only are interested in the *last* %c
            // (the user may have provided their own)
            lastC = index;
        }
    });
    args.splice(lastC, 0, c);
}
/**
 * Invokes `console.debug()` when available.
 * No-op when `console.debug` is not a "function".
 * If `console.debug` is not available, falls back
 * to `console.log`.
 *
 * @api public
 */ exports.log = console.debug || console.log || (()=>{});
/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */ function save(namespaces) {
    try {
        if (namespaces) {
            exports.storage.setItem('debug', namespaces);
        } else {
            exports.storage.removeItem('debug');
        }
    } catch (error) {
    // Swallow
    // XXX (@Qix-) should we be logging these?
    }
}
/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */ function load() {
    let r;
    try {
        r = exports.storage.getItem('debug') || exports.storage.getItem('DEBUG');
    } catch (error) {
    // Swallow
    // XXX (@Qix-) should we be logging these?
    }
    // If debug isn't set in LS, and we're in Electron, try to load $DEBUG
    if (!r && typeof process !== 'undefined' && 'env' in process) {
        r = process.env.DEBUG;
    }
    return r;
}
/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */ function localstorage() {
    try {
        // TVMLKit (Apple TV JS Runtime) does not have a window object, just localStorage in the global context
        // The Browser also has localStorage in the global context.
        return localStorage;
    } catch (error) {
    // Swallow
    // XXX (@Qix-) should we be logging these?
    }
}
module.exports = __turbopack_context__.r("[project]/central-auth/node_modules/debug/src/common.js [app-route] (ecmascript)")(exports);
const { formatters } = module.exports;
/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */ formatters.j = function(v) {
    try {
        return JSON.stringify(v);
    } catch (error) {
        return '[UnexpectedJSONParseError]: ' + error.message;
    }
};
}),
"[project]/central-auth/node_modules/debug/src/common.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 */ function setup(env) {
    createDebug.debug = createDebug;
    createDebug.default = createDebug;
    createDebug.coerce = coerce;
    createDebug.disable = disable;
    createDebug.enable = enable;
    createDebug.enabled = enabled;
    createDebug.humanize = __turbopack_context__.r("[project]/central-auth/node_modules/ms/index.js [app-route] (ecmascript)");
    createDebug.destroy = destroy;
    Object.keys(env).forEach((key)=>{
        createDebug[key] = env[key];
    });
    /**
	* The currently active debug mode names, and names to skip.
	*/ createDebug.names = [];
    createDebug.skips = [];
    /**
	* Map of special "%n" handling functions, for the debug "format" argument.
	*
	* Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
	*/ createDebug.formatters = {};
    /**
	* Selects a color for a debug namespace
	* @param {String} namespace The namespace string for the debug instance to be colored
	* @return {Number|String} An ANSI color code for the given namespace
	* @api private
	*/ function selectColor(namespace) {
        let hash = 0;
        for(let i = 0; i < namespace.length; i++){
            hash = (hash << 5) - hash + namespace.charCodeAt(i);
            hash |= 0; // Convert to 32bit integer
        }
        return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
    }
    createDebug.selectColor = selectColor;
    /**
	* Create a debugger with the given `namespace`.
	*
	* @param {String} namespace
	* @return {Function}
	* @api public
	*/ function createDebug(namespace) {
        let prevTime;
        let enableOverride = null;
        let namespacesCache;
        let enabledCache;
        function debug(...args) {
            // Disabled?
            if (!debug.enabled) {
                return;
            }
            const self = debug;
            // Set `diff` timestamp
            const curr = Number(new Date());
            const ms = curr - (prevTime || curr);
            self.diff = ms;
            self.prev = prevTime;
            self.curr = curr;
            prevTime = curr;
            args[0] = createDebug.coerce(args[0]);
            if (typeof args[0] !== 'string') {
                // Anything else let's inspect with %O
                args.unshift('%O');
            }
            // Apply any `formatters` transformations
            let index = 0;
            args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format)=>{
                // If we encounter an escaped % then don't increase the array index
                if (match === '%%') {
                    return '%';
                }
                index++;
                const formatter = createDebug.formatters[format];
                if (typeof formatter === 'function') {
                    const val = args[index];
                    match = formatter.call(self, val);
                    // Now we need to remove `args[index]` since it's inlined in the `format`
                    args.splice(index, 1);
                    index--;
                }
                return match;
            });
            // Apply env-specific formatting (colors, etc.)
            createDebug.formatArgs.call(self, args);
            const logFn = self.log || createDebug.log;
            logFn.apply(self, args);
        }
        debug.namespace = namespace;
        debug.useColors = createDebug.useColors();
        debug.color = createDebug.selectColor(namespace);
        debug.extend = extend;
        debug.destroy = createDebug.destroy; // XXX Temporary. Will be removed in the next major release.
        Object.defineProperty(debug, 'enabled', {
            enumerable: true,
            configurable: false,
            get: ()=>{
                if (enableOverride !== null) {
                    return enableOverride;
                }
                if (namespacesCache !== createDebug.namespaces) {
                    namespacesCache = createDebug.namespaces;
                    enabledCache = createDebug.enabled(namespace);
                }
                return enabledCache;
            },
            set: (v)=>{
                enableOverride = v;
            }
        });
        // Env-specific initialization logic for debug instances
        if (typeof createDebug.init === 'function') {
            createDebug.init(debug);
        }
        return debug;
    }
    function extend(namespace, delimiter) {
        const newDebug = createDebug(this.namespace + (typeof delimiter === 'undefined' ? ':' : delimiter) + namespace);
        newDebug.log = this.log;
        return newDebug;
    }
    /**
	* Enables a debug mode by namespaces. This can include modes
	* separated by a colon and wildcards.
	*
	* @param {String} namespaces
	* @api public
	*/ function enable(namespaces) {
        createDebug.save(namespaces);
        createDebug.namespaces = namespaces;
        createDebug.names = [];
        createDebug.skips = [];
        const split = (typeof namespaces === 'string' ? namespaces : '').trim().replace(/\s+/g, ',').split(',').filter(Boolean);
        for (const ns of split){
            if (ns[0] === '-') {
                createDebug.skips.push(ns.slice(1));
            } else {
                createDebug.names.push(ns);
            }
        }
    }
    /**
	 * Checks if the given string matches a namespace template, honoring
	 * asterisks as wildcards.
	 *
	 * @param {String} search
	 * @param {String} template
	 * @return {Boolean}
	 */ function matchesTemplate(search, template) {
        let searchIndex = 0;
        let templateIndex = 0;
        let starIndex = -1;
        let matchIndex = 0;
        while(searchIndex < search.length){
            if (templateIndex < template.length && (template[templateIndex] === search[searchIndex] || template[templateIndex] === '*')) {
                // Match character or proceed with wildcard
                if (template[templateIndex] === '*') {
                    starIndex = templateIndex;
                    matchIndex = searchIndex;
                    templateIndex++; // Skip the '*'
                } else {
                    searchIndex++;
                    templateIndex++;
                }
            } else if (starIndex !== -1) {
                // Backtrack to the last '*' and try to match more characters
                templateIndex = starIndex + 1;
                matchIndex++;
                searchIndex = matchIndex;
            } else {
                return false; // No match
            }
        }
        // Handle trailing '*' in template
        while(templateIndex < template.length && template[templateIndex] === '*'){
            templateIndex++;
        }
        return templateIndex === template.length;
    }
    /**
	* Disable debug output.
	*
	* @return {String} namespaces
	* @api public
	*/ function disable() {
        const namespaces = [
            ...createDebug.names,
            ...createDebug.skips.map((namespace)=>'-' + namespace)
        ].join(',');
        createDebug.enable('');
        return namespaces;
    }
    /**
	* Returns true if the given mode name is enabled, false otherwise.
	*
	* @param {String} name
	* @return {Boolean}
	* @api public
	*/ function enabled(name) {
        for (const skip of createDebug.skips){
            if (matchesTemplate(name, skip)) {
                return false;
            }
        }
        for (const ns of createDebug.names){
            if (matchesTemplate(name, ns)) {
                return true;
            }
        }
        return false;
    }
    /**
	* Coerce `val`.
	*
	* @param {Mixed} val
	* @return {Mixed}
	* @api private
	*/ function coerce(val) {
        if (val instanceof Error) {
            return val.stack || val.message;
        }
        return val;
    }
    /**
	* XXX DO NOT USE. This is a temporary stub function.
	* XXX It WILL be removed in the next major release.
	*/ function destroy() {
        console.warn('Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.');
    }
    createDebug.enable(createDebug.load());
    return createDebug;
}
module.exports = setup;
}),
"[project]/central-auth/node_modules/debug/src/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

/**
 * Detect Electron renderer / nwjs process, which is node, but we should
 * treat as a browser.
 */ if (typeof process === 'undefined' || process.type === 'renderer' || ("TURBOPACK compile-time value", false) === true || process.__nwjs) {
    module.exports = __turbopack_context__.r("[project]/central-auth/node_modules/debug/src/browser.js [app-route] (ecmascript)");
} else {
    module.exports = __turbopack_context__.r("[project]/central-auth/node_modules/debug/src/node.js [app-route] (ecmascript)");
}
}),
"[project]/central-auth/node_modules/debug/src/node.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

/**
 * Module dependencies.
 */ const tty = __turbopack_context__.r("[externals]/tty [external] (tty, cjs)");
const util = __turbopack_context__.r("[externals]/util [external] (util, cjs)");
/**
 * This is the Node.js implementation of `debug()`.
 */ exports.init = init;
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.destroy = util.deprecate(()=>{}, 'Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.');
/**
 * Colors.
 */ exports.colors = [
    6,
    2,
    3,
    4,
    5,
    1
];
try {
    // Optional dependency (as in, doesn't need to be installed, NOT like optionalDependencies in package.json)
    // eslint-disable-next-line import/no-extraneous-dependencies
    const supportsColor = __turbopack_context__.r("[project]/central-auth/node_modules/supports-color/index.js [app-route] (ecmascript)");
    if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) {
        exports.colors = [
            20,
            21,
            26,
            27,
            32,
            33,
            38,
            39,
            40,
            41,
            42,
            43,
            44,
            45,
            56,
            57,
            62,
            63,
            68,
            69,
            74,
            75,
            76,
            77,
            78,
            79,
            80,
            81,
            92,
            93,
            98,
            99,
            112,
            113,
            128,
            129,
            134,
            135,
            148,
            149,
            160,
            161,
            162,
            163,
            164,
            165,
            166,
            167,
            168,
            169,
            170,
            171,
            172,
            173,
            178,
            179,
            184,
            185,
            196,
            197,
            198,
            199,
            200,
            201,
            202,
            203,
            204,
            205,
            206,
            207,
            208,
            209,
            214,
            215,
            220,
            221
        ];
    }
} catch (error) {
// Swallow - we only care if `supports-color` is available; it doesn't have to be.
}
/**
 * Build up the default `inspectOpts` object from the environment variables.
 *
 *   $ DEBUG_COLORS=no DEBUG_DEPTH=10 DEBUG_SHOW_HIDDEN=enabled node script.js
 */ exports.inspectOpts = Object.keys(process.env).filter((key)=>{
    return /^debug_/i.test(key);
}).reduce((obj, key)=>{
    // Camel-case
    const prop = key.substring(6).toLowerCase().replace(/_([a-z])/g, (_, k)=>{
        return k.toUpperCase();
    });
    // Coerce string value into JS value
    let val = process.env[key];
    if (/^(yes|on|true|enabled)$/i.test(val)) {
        val = true;
    } else if (/^(no|off|false|disabled)$/i.test(val)) {
        val = false;
    } else if (val === 'null') {
        val = null;
    } else {
        val = Number(val);
    }
    obj[prop] = val;
    return obj;
}, {});
/**
 * Is stdout a TTY? Colored output is enabled when `true`.
 */ function useColors() {
    return 'colors' in exports.inspectOpts ? Boolean(exports.inspectOpts.colors) : tty.isatty(process.stderr.fd);
}
/**
 * Adds ANSI color escape codes if enabled.
 *
 * @api public
 */ function formatArgs(args) {
    const { namespace: name, useColors } = this;
    if (useColors) {
        const c = this.color;
        const colorCode = '\u001B[3' + (c < 8 ? c : '8;5;' + c);
        const prefix = `  ${colorCode};1m${name} \u001B[0m`;
        args[0] = prefix + args[0].split('\n').join('\n' + prefix);
        args.push(colorCode + 'm+' + module.exports.humanize(this.diff) + '\u001B[0m');
    } else {
        args[0] = getDate() + name + ' ' + args[0];
    }
}
function getDate() {
    if (exports.inspectOpts.hideDate) {
        return '';
    }
    return new Date().toISOString() + ' ';
}
/**
 * Invokes `util.formatWithOptions()` with the specified arguments and writes to stderr.
 */ function log(...args) {
    return process.stderr.write(util.formatWithOptions(exports.inspectOpts, ...args) + '\n');
}
/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */ function save(namespaces) {
    if (namespaces) {
        process.env.DEBUG = namespaces;
    } else {
        // If you set a process.env field to null or undefined, it gets cast to the
        // string 'null' or 'undefined'. Just delete instead.
        delete process.env.DEBUG;
    }
}
/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */ function load() {
    return process.env.DEBUG;
}
/**
 * Init logic for `debug` instances.
 *
 * Create a new `inspectOpts` object in case `useColors` is set
 * differently for a particular `debug` instance.
 */ function init(debug) {
    debug.inspectOpts = {};
    const keys = Object.keys(exports.inspectOpts);
    for(let i = 0; i < keys.length; i++){
        debug.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
    }
}
module.exports = __turbopack_context__.r("[project]/central-auth/node_modules/debug/src/common.js [app-route] (ecmascript)")(exports);
const { formatters } = module.exports;
/**
 * Map %o to `util.inspect()`, all on a single line.
 */ formatters.o = function(v) {
    this.inspectOpts.colors = this.useColors;
    return util.inspect(v, this.inspectOpts).split('\n').map((str)=>str.trim()).join(' ');
};
/**
 * Map %O to `util.inspect()`, allowing multiple lines if needed.
 */ formatters.O = function(v) {
    this.inspectOpts.colors = this.useColors;
    return util.inspect(v, this.inspectOpts);
};
}),
"[project]/central-auth/node_modules/delayed-stream/lib/delayed_stream.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

var Stream = __turbopack_context__.r("[externals]/stream [external] (stream, cjs)").Stream;
var util = __turbopack_context__.r("[externals]/util [external] (util, cjs)");
module.exports = DelayedStream;
function DelayedStream() {
    this.source = null;
    this.dataSize = 0;
    this.maxDataSize = 1024 * 1024;
    this.pauseStream = true;
    this._maxDataSizeExceeded = false;
    this._released = false;
    this._bufferedEvents = [];
}
util.inherits(DelayedStream, Stream);
DelayedStream.create = function(source, options) {
    var delayedStream = new this();
    options = options || {};
    for(var option in options){
        delayedStream[option] = options[option];
    }
    delayedStream.source = source;
    var realEmit = source.emit;
    source.emit = function() {
        delayedStream._handleEmit(arguments);
        return realEmit.apply(source, arguments);
    };
    source.on('error', function() {});
    if (delayedStream.pauseStream) {
        source.pause();
    }
    return delayedStream;
};
Object.defineProperty(DelayedStream.prototype, 'readable', {
    configurable: true,
    enumerable: true,
    get: function() {
        return this.source.readable;
    }
});
DelayedStream.prototype.setEncoding = function() {
    return this.source.setEncoding.apply(this.source, arguments);
};
DelayedStream.prototype.resume = function() {
    if (!this._released) {
        this.release();
    }
    this.source.resume();
};
DelayedStream.prototype.pause = function() {
    this.source.pause();
};
DelayedStream.prototype.release = function() {
    this._released = true;
    this._bufferedEvents.forEach((function(args) {
        this.emit.apply(this, args);
    }).bind(this));
    this._bufferedEvents = [];
};
DelayedStream.prototype.pipe = function() {
    var r = Stream.prototype.pipe.apply(this, arguments);
    this.resume();
    return r;
};
DelayedStream.prototype._handleEmit = function(args) {
    if (this._released) {
        this.emit.apply(this, args);
        return;
    }
    if (args[0] === 'data') {
        this.dataSize += args[1].length;
        this._checkIfMaxDataSizeExceeded();
    }
    this._bufferedEvents.push(args);
};
DelayedStream.prototype._checkIfMaxDataSizeExceeded = function() {
    if (this._maxDataSizeExceeded) {
        return;
    }
    if (this.dataSize <= this.maxDataSize) {
        return;
    }
    this._maxDataSizeExceeded = true;
    var message = 'DelayedStream#maxDataSize of ' + this.maxDataSize + ' bytes exceeded.';
    this.emit('error', new Error(message));
};
}),
"[project]/central-auth/node_modules/dunder-proto/get.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var callBind = __turbopack_context__.r("[project]/central-auth/node_modules/call-bind-apply-helpers/index.js [app-route] (ecmascript)");
var gOPD = __turbopack_context__.r("[project]/central-auth/node_modules/gopd/index.js [app-route] (ecmascript)");
var hasProtoAccessor;
try {
    // eslint-disable-next-line no-extra-parens, no-proto
    hasProtoAccessor = /** @type {{ __proto__?: typeof Array.prototype }} */ [].__proto__ === Array.prototype;
} catch (e) {
    if (!e || typeof e !== 'object' || !('code' in e) || e.code !== 'ERR_PROTO_ACCESS') {
        throw e;
    }
}
// eslint-disable-next-line no-extra-parens
var desc = !!hasProtoAccessor && gOPD && gOPD(Object.prototype, '__proto__');
var $Object = Object;
var $getPrototypeOf = $Object.getPrototypeOf;
/** @type {import('./get')} */ module.exports = desc && typeof desc.get === 'function' ? callBind([
    desc.get
]) : typeof $getPrototypeOf === 'function' ? /** @type {import('./get')} */ function getDunder(value) {
    // eslint-disable-next-line eqeqeq
    return $getPrototypeOf(value == null ? value : $Object(value));
} : false;
}),
"[project]/central-auth/node_modules/es-define-property/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('.')} */ var $defineProperty = Object.defineProperty || false;
if ($defineProperty) {
    try {
        $defineProperty({}, 'a', {
            value: 1
        });
    } catch (e) {
        // IE 8 has a broken defineProperty
        $defineProperty = false;
    }
}
module.exports = $defineProperty;
}),
"[project]/central-auth/node_modules/es-errors/eval.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('./eval')} */ module.exports = EvalError;
}),
"[project]/central-auth/node_modules/es-errors/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('.')} */ module.exports = Error;
}),
"[project]/central-auth/node_modules/es-errors/range.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('./range')} */ module.exports = RangeError;
}),
"[project]/central-auth/node_modules/es-errors/ref.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('./ref')} */ module.exports = ReferenceError;
}),
"[project]/central-auth/node_modules/es-errors/syntax.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('./syntax')} */ module.exports = SyntaxError;
}),
"[project]/central-auth/node_modules/es-errors/type.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('./type')} */ module.exports = TypeError;
}),
"[project]/central-auth/node_modules/es-errors/uri.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('./uri')} */ module.exports = URIError;
}),
"[project]/central-auth/node_modules/es-object-atoms/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('.')} */ module.exports = Object;
}),
"[project]/central-auth/node_modules/es-set-tostringtag/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var GetIntrinsic = __turbopack_context__.r("[project]/central-auth/node_modules/get-intrinsic/index.js [app-route] (ecmascript)");
var $defineProperty = GetIntrinsic('%Object.defineProperty%', true);
var hasToStringTag = __turbopack_context__.r("[project]/central-auth/node_modules/has-tostringtag/shams.js [app-route] (ecmascript)")();
var hasOwn = __turbopack_context__.r("[project]/central-auth/node_modules/hasown/index.js [app-route] (ecmascript)");
var $TypeError = __turbopack_context__.r("[project]/central-auth/node_modules/es-errors/type.js [app-route] (ecmascript)");
var toStringTag = hasToStringTag ? Symbol.toStringTag : null;
/** @type {import('.')} */ module.exports = function setToStringTag(object, value) {
    var overrideIfSet = arguments.length > 2 && !!arguments[2] && arguments[2].force;
    var nonConfigurable = arguments.length > 2 && !!arguments[2] && arguments[2].nonConfigurable;
    if (typeof overrideIfSet !== 'undefined' && typeof overrideIfSet !== 'boolean' || typeof nonConfigurable !== 'undefined' && typeof nonConfigurable !== 'boolean') {
        throw new $TypeError('if provided, the `overrideIfSet` and `nonConfigurable` options must be booleans');
    }
    if (toStringTag && (overrideIfSet || !hasOwn(object, toStringTag))) {
        if ($defineProperty) {
            $defineProperty(object, toStringTag, {
                configurable: !nonConfigurable,
                enumerable: false,
                value: value,
                writable: false
            });
        } else {
            object[toStringTag] = value; // eslint-disable-line no-param-reassign
        }
    }
};
}),
"[project]/central-auth/node_modules/fast-defer/dist/index.mjs [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "deferred",
    ()=>e,
    "isDeferred",
    ()=>n
]);
var r = Symbol();
function e() {
    var e, n, o = new Promise(function(r, o) {
        e = r, n = o;
    });
    return o.resolve = e, o.reject = n, o[r] = 1, o;
}
function n(e) {
    return !!e && !!e[r];
}
;
}),
"[project]/central-auth/node_modules/follow-redirects/debug.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

var debug;
module.exports = function() {
    if (!debug) {
        try {
            /* eslint global-require: off */ debug = __turbopack_context__.r("[project]/central-auth/node_modules/debug/src/index.js [app-route] (ecmascript)")("follow-redirects");
        } catch (error) {}
        if (typeof debug !== "function") {
            debug = function() {};
        }
    }
    debug.apply(null, arguments);
};
}),
"[project]/central-auth/node_modules/follow-redirects/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

var url = __turbopack_context__.r("[externals]/url [external] (url, cjs)");
var URL = url.URL;
var http = __turbopack_context__.r("[externals]/http [external] (http, cjs)");
var https = __turbopack_context__.r("[externals]/https [external] (https, cjs)");
var Writable = __turbopack_context__.r("[externals]/stream [external] (stream, cjs)").Writable;
var assert = __turbopack_context__.r("[externals]/assert [external] (assert, cjs)");
var debug = __turbopack_context__.r("[project]/central-auth/node_modules/follow-redirects/debug.js [app-route] (ecmascript)");
// Preventive platform detection
// istanbul ignore next
(function detectUnsupportedEnvironment() {
    var looksLikeNode = typeof process !== "undefined";
    var looksLikeBrowser = ("TURBOPACK compile-time value", "undefined") !== "undefined" && typeof document !== "undefined";
    var looksLikeV8 = isFunction(Error.captureStackTrace);
    if (!looksLikeNode && (looksLikeBrowser || !looksLikeV8)) {
        console.warn("The follow-redirects package should be excluded from browser builds.");
    }
})();
// Whether to use the native URL object or the legacy url module
var useNativeURL = false;
try {
    assert(new URL(""));
} catch (error) {
    useNativeURL = error.code === "ERR_INVALID_URL";
}
// HTTP headers to drop across HTTP/HTTPS and domain boundaries
var sensitiveHeaders = [
    "Authorization",
    "Proxy-Authorization",
    "Cookie"
];
// URL fields to preserve in copy operations
var preservedUrlFields = [
    "auth",
    "host",
    "hostname",
    "href",
    "path",
    "pathname",
    "port",
    "protocol",
    "query",
    "search",
    "hash"
];
// Create handlers that pass events from native requests
var events = [
    "abort",
    "aborted",
    "connect",
    "error",
    "socket",
    "timeout"
];
var eventHandlers = Object.create(null);
events.forEach(function(event) {
    eventHandlers[event] = function(arg1, arg2, arg3) {
        this._redirectable.emit(event, arg1, arg2, arg3);
    };
});
// Error types with codes
var InvalidUrlError = createErrorType("ERR_INVALID_URL", "Invalid URL", TypeError);
var RedirectionError = createErrorType("ERR_FR_REDIRECTION_FAILURE", "Redirected request failed");
var TooManyRedirectsError = createErrorType("ERR_FR_TOO_MANY_REDIRECTS", "Maximum number of redirects exceeded", RedirectionError);
var MaxBodyLengthExceededError = createErrorType("ERR_FR_MAX_BODY_LENGTH_EXCEEDED", "Request body larger than maxBodyLength limit");
var WriteAfterEndError = createErrorType("ERR_STREAM_WRITE_AFTER_END", "write after end");
// istanbul ignore next
var destroy = Writable.prototype.destroy || noop;
// An HTTP(S) request that can be redirected
function RedirectableRequest(options, responseCallback) {
    // Initialize the request
    Writable.call(this);
    this._sanitizeOptions(options);
    this._options = options;
    this._ended = false;
    this._ending = false;
    this._redirectCount = 0;
    this._redirects = [];
    this._requestBodyLength = 0;
    this._requestBodyBuffers = [];
    // Attach a callback if passed
    if (responseCallback) {
        this.on("response", responseCallback);
    }
    // React to responses of native requests
    var self = this;
    this._onNativeResponse = function(response) {
        try {
            self._processResponse(response);
        } catch (cause) {
            self.emit("error", cause instanceof RedirectionError ? cause : new RedirectionError({
                cause: cause
            }));
        }
    };
    // Create filter for sensitive HTTP headers
    this._headerFilter = new RegExp("^(?:" + sensitiveHeaders.concat(options.sensitiveHeaders).map(escapeRegex).join("|") + ")$", "i");
    // Perform the first request
    this._performRequest();
}
RedirectableRequest.prototype = Object.create(Writable.prototype);
RedirectableRequest.prototype.abort = function() {
    destroyRequest(this._currentRequest);
    this._currentRequest.abort();
    this.emit("abort");
};
RedirectableRequest.prototype.destroy = function(error) {
    destroyRequest(this._currentRequest, error);
    destroy.call(this, error);
    return this;
};
// Writes buffered data to the current native request
RedirectableRequest.prototype.write = function(data, encoding, callback) {
    // Writing is not allowed if end has been called
    if (this._ending) {
        throw new WriteAfterEndError();
    }
    // Validate input and shift parameters if necessary
    if (!isString(data) && !isBuffer(data)) {
        throw new TypeError("data should be a string, Buffer or Uint8Array");
    }
    if (isFunction(encoding)) {
        callback = encoding;
        encoding = null;
    }
    // Ignore empty buffers, since writing them doesn't invoke the callback
    // https://github.com/nodejs/node/issues/22066
    if (data.length === 0) {
        if (callback) {
            callback();
        }
        return;
    }
    // Only write when we don't exceed the maximum body length
    if (this._requestBodyLength + data.length <= this._options.maxBodyLength) {
        this._requestBodyLength += data.length;
        this._requestBodyBuffers.push({
            data: data,
            encoding: encoding
        });
        this._currentRequest.write(data, encoding, callback);
    } else {
        this.emit("error", new MaxBodyLengthExceededError());
        this.abort();
    }
};
// Ends the current native request
RedirectableRequest.prototype.end = function(data, encoding, callback) {
    // Shift parameters if necessary
    if (isFunction(data)) {
        callback = data;
        data = encoding = null;
    } else if (isFunction(encoding)) {
        callback = encoding;
        encoding = null;
    }
    // Write data if needed and end
    if (!data) {
        this._ended = this._ending = true;
        this._currentRequest.end(null, null, callback);
    } else {
        var self = this;
        var currentRequest = this._currentRequest;
        this.write(data, encoding, function() {
            self._ended = true;
            currentRequest.end(null, null, callback);
        });
        this._ending = true;
    }
};
// Sets a header value on the current native request
RedirectableRequest.prototype.setHeader = function(name, value) {
    this._options.headers[name] = value;
    this._currentRequest.setHeader(name, value);
};
// Clears a header value on the current native request
RedirectableRequest.prototype.removeHeader = function(name) {
    delete this._options.headers[name];
    this._currentRequest.removeHeader(name);
};
// Global timeout for all underlying requests
RedirectableRequest.prototype.setTimeout = function(msecs, callback) {
    var self = this;
    // Destroys the socket on timeout
    function destroyOnTimeout(socket) {
        socket.setTimeout(msecs);
        socket.removeListener("timeout", socket.destroy);
        socket.addListener("timeout", socket.destroy);
    }
    // Sets up a timer to trigger a timeout event
    function startTimer(socket) {
        if (self._timeout) {
            clearTimeout(self._timeout);
        }
        self._timeout = setTimeout(function() {
            self.emit("timeout");
            clearTimer();
        }, msecs);
        destroyOnTimeout(socket);
    }
    // Stops a timeout from triggering
    function clearTimer() {
        // Clear the timeout
        if (self._timeout) {
            clearTimeout(self._timeout);
            self._timeout = null;
        }
        // Clean up all attached listeners
        self.removeListener("abort", clearTimer);
        self.removeListener("error", clearTimer);
        self.removeListener("response", clearTimer);
        self.removeListener("close", clearTimer);
        if (callback) {
            self.removeListener("timeout", callback);
        }
        if (!self.socket) {
            self._currentRequest.removeListener("socket", startTimer);
        }
    }
    // Attach callback if passed
    if (callback) {
        this.on("timeout", callback);
    }
    // Start the timer if or when the socket is opened
    if (this.socket) {
        startTimer(this.socket);
    } else {
        this._currentRequest.once("socket", startTimer);
    }
    // Clean up on events
    this.on("socket", destroyOnTimeout);
    this.on("abort", clearTimer);
    this.on("error", clearTimer);
    this.on("response", clearTimer);
    this.on("close", clearTimer);
    return this;
};
// Proxy all other public ClientRequest methods
[
    "flushHeaders",
    "getHeader",
    "setNoDelay",
    "setSocketKeepAlive"
].forEach(function(method) {
    RedirectableRequest.prototype[method] = function(a, b) {
        return this._currentRequest[method](a, b);
    };
});
// Proxy all public ClientRequest properties
[
    "aborted",
    "connection",
    "socket"
].forEach(function(property) {
    Object.defineProperty(RedirectableRequest.prototype, property, {
        get: function() {
            return this._currentRequest[property];
        }
    });
});
RedirectableRequest.prototype._sanitizeOptions = function(options) {
    // Ensure headers are always present
    if (!options.headers) {
        options.headers = {};
    } else if (Array.isArray(options.headers)) {
        var headerList = options.headers;
        options.headers = {};
        for(var i = 0; i < headerList.length; i += 2){
            options.headers[headerList[i]] = headerList[i + 1];
        }
    }
    // Ensure sensitive headers are always present
    if (!Array.isArray(options.sensitiveHeaders)) {
        options.sensitiveHeaders = [];
    }
    // Since http.request treats host as an alias of hostname,
    // but the url module interprets host as hostname plus port,
    // eliminate the host property to avoid confusion.
    if (options.host) {
        // Use hostname if set, because it has precedence
        if (!options.hostname) {
            options.hostname = options.host;
        }
        delete options.host;
    }
    // Complete the URL object when necessary
    if (!options.pathname && options.path) {
        var searchPos = options.path.indexOf("?");
        if (searchPos < 0) {
            options.pathname = options.path;
        } else {
            options.pathname = options.path.substring(0, searchPos);
            options.search = options.path.substring(searchPos);
        }
    }
};
// Executes the next native request (initial or redirect)
RedirectableRequest.prototype._performRequest = function() {
    // Load the native protocol
    var protocol = this._options.protocol;
    var nativeProtocol = this._options.nativeProtocols[protocol];
    if (!nativeProtocol) {
        throw new TypeError("Unsupported protocol " + protocol);
    }
    // If specified, use the agent corresponding to the protocol
    // (HTTP and HTTPS use different types of agents)
    if (this._options.agents) {
        var scheme = protocol.slice(0, -1);
        this._options.agent = this._options.agents[scheme];
    }
    // Create the native request and set up its event handlers
    var request = this._currentRequest = nativeProtocol.request(this._options, this._onNativeResponse);
    request._redirectable = this;
    for (var event of events){
        request.on(event, eventHandlers[event]);
    }
    // RFC7230§5.3.1: When making a request directly to an origin server, […]
    // a client MUST send only the absolute path […] as the request-target.
    this._currentUrl = /^\//.test(this._options.path) ? url.format(this._options) : // When making a request to a proxy, […]
    // a client MUST send the target URI in absolute-form […].
    this._options.path;
    // End a redirected request
    // (The first request must be ended explicitly with RedirectableRequest#end)
    if (this._isRedirect) {
        // Write the request entity and end
        var i = 0;
        var self = this;
        var buffers = this._requestBodyBuffers;
        (function writeNext(error) {
            // Only write if this request has not been redirected yet
            // istanbul ignore else
            if (request === self._currentRequest) {
                // Report any write errors
                // istanbul ignore if
                if (error) {
                    self.emit("error", error);
                } else if (i < buffers.length) {
                    var buffer = buffers[i++];
                    // istanbul ignore else
                    if (!request.finished) {
                        request.write(buffer.data, buffer.encoding, writeNext);
                    }
                } else if (self._ended) {
                    request.end();
                }
            }
        })();
    }
};
// Processes a response from the current native request
RedirectableRequest.prototype._processResponse = function(response) {
    // Store the redirected response
    var statusCode = response.statusCode;
    if (this._options.trackRedirects) {
        this._redirects.push({
            url: this._currentUrl,
            headers: response.headers,
            statusCode: statusCode
        });
    }
    // RFC7231§6.4: The 3xx (Redirection) class of status code indicates
    // that further action needs to be taken by the user agent in order to
    // fulfill the request. If a Location header field is provided,
    // the user agent MAY automatically redirect its request to the URI
    // referenced by the Location field value,
    // even if the specific status code is not understood.
    // If the response is not a redirect; return it as-is
    var location = response.headers.location;
    if (!location || this._options.followRedirects === false || statusCode < 300 || statusCode >= 400) {
        response.responseUrl = this._currentUrl;
        response.redirects = this._redirects;
        this.emit("response", response);
        // Clean up
        this._requestBodyBuffers = [];
        return;
    }
    // The response is a redirect, so abort the current request
    destroyRequest(this._currentRequest);
    // Discard the remainder of the response to avoid waiting for data
    response.destroy();
    // RFC7231§6.4: A client SHOULD detect and intervene
    // in cyclical redirections (i.e., "infinite" redirection loops).
    if (++this._redirectCount > this._options.maxRedirects) {
        throw new TooManyRedirectsError();
    }
    // Store the request headers if applicable
    var requestHeaders;
    var beforeRedirect = this._options.beforeRedirect;
    if (beforeRedirect) {
        requestHeaders = Object.assign({
            // The Host header was set by nativeProtocol.request
            Host: response.req.getHeader("host")
        }, this._options.headers);
    }
    // RFC7231§6.4: Automatic redirection needs to done with
    // care for methods not known to be safe, […]
    // RFC7231§6.4.2–3: For historical reasons, a user agent MAY change
    // the request method from POST to GET for the subsequent request.
    var method = this._options.method;
    if ((statusCode === 301 || statusCode === 302) && this._options.method === "POST" || // RFC7231§6.4.4: The 303 (See Other) status code indicates that
    // the server is redirecting the user agent to a different resource […]
    // A user agent can perform a retrieval request targeting that URI
    // (a GET or HEAD request if using HTTP) […]
    statusCode === 303 && !/^(?:GET|HEAD)$/.test(this._options.method)) {
        this._options.method = "GET";
        // Drop a possible entity and headers related to it
        this._requestBodyBuffers = [];
        removeMatchingHeaders(/^content-/i, this._options.headers);
    }
    // Drop the Host header, as the redirect might lead to a different host
    var currentHostHeader = removeMatchingHeaders(/^host$/i, this._options.headers);
    // If the redirect is relative, carry over the host of the last request
    var currentUrlParts = parseUrl(this._currentUrl);
    var currentHost = currentHostHeader || currentUrlParts.host;
    var currentUrl = /^\w+:/.test(location) ? this._currentUrl : url.format(Object.assign(currentUrlParts, {
        host: currentHost
    }));
    // Create the redirected request
    var redirectUrl = resolveUrl(location, currentUrl);
    debug("redirecting to", redirectUrl.href);
    this._isRedirect = true;
    spreadUrlObject(redirectUrl, this._options);
    // Drop confidential headers when redirecting to a less secure protocol
    // or to a different domain that is not a superdomain
    if (redirectUrl.protocol !== currentUrlParts.protocol && redirectUrl.protocol !== "https:" || redirectUrl.host !== currentHost && !isSubdomain(redirectUrl.host, currentHost)) {
        removeMatchingHeaders(this._headerFilter, this._options.headers);
    }
    // Evaluate the beforeRedirect callback
    if (isFunction(beforeRedirect)) {
        var responseDetails = {
            headers: response.headers,
            statusCode: statusCode
        };
        var requestDetails = {
            url: currentUrl,
            method: method,
            headers: requestHeaders
        };
        beforeRedirect(this._options, responseDetails, requestDetails);
        this._sanitizeOptions(this._options);
    }
    // Perform the redirected request
    this._performRequest();
};
// Wraps the key/value object of protocols with redirect functionality
function wrap(protocols) {
    // Default settings
    var exports = {
        maxRedirects: 21,
        maxBodyLength: 10 * 1024 * 1024
    };
    // Wrap each protocol
    var nativeProtocols = {};
    Object.keys(protocols).forEach(function(scheme) {
        var protocol = scheme + ":";
        var nativeProtocol = nativeProtocols[protocol] = protocols[scheme];
        var wrappedProtocol = exports[scheme] = Object.create(nativeProtocol);
        // Executes a request, following redirects
        function request(input, options, callback) {
            // Parse parameters, ensuring that input is an object
            if (isURL(input)) {
                input = spreadUrlObject(input);
            } else if (isString(input)) {
                input = spreadUrlObject(parseUrl(input));
            } else {
                callback = options;
                options = validateUrl(input);
                input = {
                    protocol: protocol
                };
            }
            if (isFunction(options)) {
                callback = options;
                options = null;
            }
            // Set defaults
            options = Object.assign({
                maxRedirects: exports.maxRedirects,
                maxBodyLength: exports.maxBodyLength
            }, input, options);
            options.nativeProtocols = nativeProtocols;
            if (!isString(options.host) && !isString(options.hostname)) {
                options.hostname = "::1";
            }
            assert.equal(options.protocol, protocol, "protocol mismatch");
            debug("options", options);
            return new RedirectableRequest(options, callback);
        }
        // Executes a GET request, following redirects
        function get(input, options, callback) {
            var wrappedRequest = wrappedProtocol.request(input, options, callback);
            wrappedRequest.end();
            return wrappedRequest;
        }
        // Expose the properties on the wrapped protocol
        Object.defineProperties(wrappedProtocol, {
            request: {
                value: request,
                configurable: true,
                enumerable: true,
                writable: true
            },
            get: {
                value: get,
                configurable: true,
                enumerable: true,
                writable: true
            }
        });
    });
    return exports;
}
function noop() {}
function parseUrl(input) {
    var parsed;
    // istanbul ignore else
    if (useNativeURL) {
        parsed = new URL(input);
    } else {
        // Ensure the URL is valid and absolute
        parsed = validateUrl(url.parse(input));
        if (!isString(parsed.protocol)) {
            throw new InvalidUrlError({
                input
            });
        }
    }
    return parsed;
}
function resolveUrl(relative, base) {
    // istanbul ignore next
    return useNativeURL ? new URL(relative, base) : parseUrl(url.resolve(base, relative));
}
function validateUrl(input) {
    if (/^\[/.test(input.hostname) && !/^\[[:0-9a-f]+\]$/i.test(input.hostname)) {
        throw new InvalidUrlError({
            input: input.href || input
        });
    }
    if (/^\[/.test(input.host) && !/^\[[:0-9a-f]+\](:\d+)?$/i.test(input.host)) {
        throw new InvalidUrlError({
            input: input.href || input
        });
    }
    return input;
}
function spreadUrlObject(urlObject, target) {
    var spread = target || {};
    for (var key of preservedUrlFields){
        spread[key] = urlObject[key];
    }
    // Fix IPv6 hostname
    if (spread.hostname.startsWith("[")) {
        spread.hostname = spread.hostname.slice(1, -1);
    }
    // Ensure port is a number
    if (spread.port !== "") {
        spread.port = Number(spread.port);
    }
    // Concatenate path
    spread.path = spread.search ? spread.pathname + spread.search : spread.pathname;
    return spread;
}
function removeMatchingHeaders(regex, headers) {
    var lastValue;
    for(var header in headers){
        if (regex.test(header)) {
            lastValue = headers[header];
            delete headers[header];
        }
    }
    return lastValue === null || typeof lastValue === "undefined" ? undefined : String(lastValue).trim();
}
function createErrorType(code, message, baseClass) {
    // Create constructor
    function CustomError(properties) {
        // istanbul ignore else
        if (isFunction(Error.captureStackTrace)) {
            Error.captureStackTrace(this, this.constructor);
        }
        Object.assign(this, properties || {});
        this.code = code;
        this.message = this.cause ? message + ": " + this.cause.message : message;
    }
    // Attach constructor and set default properties
    CustomError.prototype = new (baseClass || Error)();
    Object.defineProperties(CustomError.prototype, {
        constructor: {
            value: CustomError,
            enumerable: false
        },
        name: {
            value: "Error [" + code + "]",
            enumerable: false
        }
    });
    return CustomError;
}
function destroyRequest(request, error) {
    for (var event of events){
        request.removeListener(event, eventHandlers[event]);
    }
    request.on("error", noop);
    request.destroy(error);
}
function isSubdomain(subdomain, domain) {
    assert(isString(subdomain) && isString(domain));
    var dot = subdomain.length - domain.length - 1;
    return dot > 0 && subdomain[dot] === "." && subdomain.endsWith(domain);
}
function isString(value) {
    return typeof value === "string" || value instanceof String;
}
function isFunction(value) {
    return typeof value === "function";
}
function isBuffer(value) {
    return typeof value === "object" && "length" in value;
}
function isURL(value) {
    return URL && value instanceof URL;
}
function escapeRegex(regex) {
    // As per https://tc39.es/proposal-regexp-modifiers/#prod-SyntaxCharacter
    return regex.replace(/[\^$\\.*+?()[\]{}|]/g, "\\$&");
}
// Exports
module.exports = wrap({
    http: http,
    https: https
});
module.exports.wrap = wrap;
}),
"[project]/central-auth/node_modules/form-data/lib/form_data.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var CombinedStream = __turbopack_context__.r("[project]/central-auth/node_modules/combined-stream/lib/combined_stream.js [app-route] (ecmascript)");
var util = __turbopack_context__.r("[externals]/util [external] (util, cjs)");
var path = __turbopack_context__.r("[externals]/path [external] (path, cjs)");
var http = __turbopack_context__.r("[externals]/http [external] (http, cjs)");
var https = __turbopack_context__.r("[externals]/https [external] (https, cjs)");
var parseUrl = __turbopack_context__.r("[externals]/url [external] (url, cjs)").parse;
var fs = __turbopack_context__.r("[externals]/fs [external] (fs, cjs)");
var Stream = __turbopack_context__.r("[externals]/stream [external] (stream, cjs)").Stream;
var crypto = __turbopack_context__.r("[externals]/crypto [external] (crypto, cjs)");
var mime = __turbopack_context__.r("[project]/central-auth/node_modules/mime-types/index.js [app-route] (ecmascript)");
var asynckit = __turbopack_context__.r("[project]/central-auth/node_modules/asynckit/index.js [app-route] (ecmascript)");
var setToStringTag = __turbopack_context__.r("[project]/central-auth/node_modules/es-set-tostringtag/index.js [app-route] (ecmascript)");
var hasOwn = __turbopack_context__.r("[project]/central-auth/node_modules/hasown/index.js [app-route] (ecmascript)");
var populate = __turbopack_context__.r("[project]/central-auth/node_modules/form-data/lib/populate.js [app-route] (ecmascript)");
/**
 * Escape CR, LF, and `"` in a multipart `name`/`filename` parameter, so a field
 * name or filename can not break out of its header line to inject headers or
 * smuggle additional parts. Matches the WHATWG HTML multipart/form-data encoding.
 *
 * @param {string} str - the parameter value to escape
 * @returns {string} the escaped value
 */ function escapeHeaderParam(str) {
    return String(str).replace(/\r/g, '%0D').replace(/\n/g, '%0A').replace(/"/g, '%22');
}
/**
 * Create readable "multipart/form-data" streams.
 * Can be used to submit forms
 * and file uploads to other web applications.
 *
 * @constructor
 * @param {object} options - Properties to be added/overriden for FormData and CombinedStream
 */ function FormData(options) {
    if (!(this instanceof FormData)) {
        return new FormData(options);
    }
    this._overheadLength = 0;
    this._valueLength = 0;
    this._valuesToMeasure = [];
    CombinedStream.call(this);
    options = options || {}; // eslint-disable-line no-param-reassign
    for(var option in options){
        this[option] = options[option];
    }
}
// make it a Stream
util.inherits(FormData, CombinedStream);
FormData.LINE_BREAK = '\r\n';
FormData.DEFAULT_CONTENT_TYPE = 'application/octet-stream';
FormData.prototype.append = function(field, value, options) {
    options = options || {}; // eslint-disable-line no-param-reassign
    // allow filename as single option
    if (typeof options === 'string') {
        options = {
            filename: options
        }; // eslint-disable-line no-param-reassign
    }
    var append = CombinedStream.prototype.append.bind(this);
    // all that streamy business can't handle numbers
    if (typeof value === 'number' || value == null) {
        value = String(value); // eslint-disable-line no-param-reassign
    }
    // https://github.com/felixge/node-form-data/issues/38
    if (Array.isArray(value)) {
        /*
     * Please convert your array into string
     * the way web server expects it
     */ this._error(new Error('Arrays are not supported.'));
        return;
    }
    var header = this._multiPartHeader(field, value, options);
    var footer = this._multiPartFooter();
    append(header);
    append(value);
    append(footer);
    // pass along options.knownLength
    this._trackLength(header, value, options);
};
FormData.prototype._trackLength = function(header, value, options) {
    var valueLength = 0;
    /*
   * used w/ getLengthSync(), when length is known.
   * e.g. for streaming directly from a remote server,
   * w/ a known file a size, and not wanting to wait for
   * incoming file to finish to get its size.
   */ if (options.knownLength != null) {
        valueLength += Number(options.knownLength);
    } else if (Buffer.isBuffer(value)) {
        valueLength = value.length;
    } else if (typeof value === 'string') {
        valueLength = Buffer.byteLength(value);
    }
    this._valueLength += valueLength;
    // @check why add CRLF? does this account for custom/multiple CRLFs?
    this._overheadLength += Buffer.byteLength(header) + FormData.LINE_BREAK.length;
    // empty or either doesn't have path or not an http response or not a stream
    if (!value || !value.path && !(value.readable && hasOwn(value, 'httpVersion')) && !(value instanceof Stream)) {
        return;
    }
    // no need to bother with the length
    if (!options.knownLength) {
        this._valuesToMeasure.push(value);
    }
};
FormData.prototype._lengthRetriever = function(value, callback) {
    if (hasOwn(value, 'fd')) {
        // take read range into a account
        // `end` = Infinity –> read file till the end
        //
        // TODO: Looks like there is bug in Node fs.createReadStream
        // it doesn't respect `end` options without `start` options
        // Fix it when node fixes it.
        // https://github.com/joyent/node/issues/7819
        if (value.end != undefined && value.end != Infinity && value.start != undefined) {
            // when end specified
            // no need to calculate range
            // inclusive, starts with 0
            callback(null, value.end + 1 - (value.start ? value.start : 0)); // eslint-disable-line callback-return
        // not that fast snoopy
        } else {
            // still need to fetch file size from fs
            fs.stat(value.path, function(err, stat) {
                if (err) {
                    callback(err);
                    return;
                }
                // update final size based on the range options
                var fileSize = stat.size - (value.start ? value.start : 0);
                callback(null, fileSize);
            });
        }
    // or http response
    } else if (hasOwn(value, 'httpVersion')) {
        callback(null, Number(value.headers['content-length'])); // eslint-disable-line callback-return
    // or request stream http://github.com/mikeal/request
    } else if (hasOwn(value, 'httpModule')) {
        // wait till response come back
        value.on('response', function(response) {
            value.pause();
            callback(null, Number(response.headers['content-length']));
        });
        value.resume();
    // something else
    } else {
        callback('Unknown stream'); // eslint-disable-line callback-return
    }
};
FormData.prototype._multiPartHeader = function(field, value, options) {
    /*
   * custom header specified (as string)?
   * it becomes responsible for boundary
   * (e.g. to handle extra CRLFs on .NET servers)
   */ if (typeof options.header === 'string') {
        return options.header;
    }
    var contentDisposition = this._getContentDisposition(value, options);
    var contentType = this._getContentType(value, options);
    var contents = '';
    var headers = {
        // add custom disposition as third element or keep it two elements if not
        'Content-Disposition': [
            'form-data',
            'name="' + escapeHeaderParam(field) + '"'
        ].concat(contentDisposition || []),
        // if no content type. allow it to be empty array
        'Content-Type': [].concat(contentType || [])
    };
    // allow custom headers.
    if (typeof options.header === 'object') {
        populate(headers, options.header);
    }
    var header;
    for(var prop in headers){
        if (hasOwn(headers, prop)) {
            header = headers[prop];
            // skip nullish headers.
            if (header == null) {
                continue; // eslint-disable-line no-restricted-syntax, no-continue
            }
            // convert all headers to arrays.
            if (!Array.isArray(header)) {
                header = [
                    header
                ];
            }
            // add non-empty headers.
            if (header.length) {
                contents += prop + ': ' + header.join('; ') + FormData.LINE_BREAK;
            }
        }
    }
    return '--' + this.getBoundary() + FormData.LINE_BREAK + contents + FormData.LINE_BREAK;
};
FormData.prototype._getContentDisposition = function(value, options) {
    var filename;
    if (typeof options.filepath === 'string') {
        // custom filepath for relative paths
        filename = path.normalize(options.filepath).replace(/\\/g, '/');
    } else if (options.filename || value && (value.name || value.path)) {
        /*
     * custom filename take precedence
     * formidable and the browser add a name property
     * fs- and request- streams have path property
     */ filename = path.basename(options.filename || value && (value.name || value.path));
    } else if (value && value.readable && hasOwn(value, 'httpVersion')) {
        // or try http response
        filename = path.basename(value.client._httpMessage.path || '');
    }
    if (filename) {
        return 'filename="' + escapeHeaderParam(filename) + '"';
    }
};
FormData.prototype._getContentType = function(value, options) {
    // use custom content-type above all
    var contentType = options.contentType;
    // or try `name` from formidable, browser
    if (!contentType && value && value.name) {
        contentType = mime.lookup(value.name);
    }
    // or try `path` from fs-, request- streams
    if (!contentType && value && value.path) {
        contentType = mime.lookup(value.path);
    }
    // or if it's http-reponse
    if (!contentType && value && value.readable && hasOwn(value, 'httpVersion')) {
        contentType = value.headers['content-type'];
    }
    // or guess it from the filepath or filename
    if (!contentType && (options.filepath || options.filename)) {
        contentType = mime.lookup(options.filepath || options.filename);
    }
    // fallback to the default content type if `value` is not simple value
    if (!contentType && value && typeof value === 'object') {
        contentType = FormData.DEFAULT_CONTENT_TYPE;
    }
    return contentType;
};
FormData.prototype._multiPartFooter = function() {
    return (function(next) {
        var footer = FormData.LINE_BREAK;
        var lastPart = this._streams.length === 0;
        if (lastPart) {
            footer += this._lastBoundary();
        }
        next(footer);
    }).bind(this);
};
FormData.prototype._lastBoundary = function() {
    return '--' + this.getBoundary() + '--' + FormData.LINE_BREAK;
};
FormData.prototype.getHeaders = function(userHeaders) {
    var header;
    var formHeaders = {
        'content-type': 'multipart/form-data; boundary=' + this.getBoundary()
    };
    for(header in userHeaders){
        if (hasOwn(userHeaders, header)) {
            formHeaders[header.toLowerCase()] = userHeaders[header];
        }
    }
    return formHeaders;
};
FormData.prototype.setBoundary = function(boundary) {
    if (typeof boundary !== 'string') {
        throw new TypeError('FormData boundary must be a string');
    }
    this._boundary = boundary;
};
FormData.prototype.getBoundary = function() {
    if (!this._boundary) {
        this._generateBoundary();
    }
    return this._boundary;
};
FormData.prototype.getBuffer = function() {
    var dataBuffer = new Buffer.alloc(0); // eslint-disable-line new-cap
    var boundary = this.getBoundary();
    // Create the form content. Add Line breaks to the end of data.
    for(var i = 0, len = this._streams.length; i < len; i++){
        if (typeof this._streams[i] !== 'function') {
            // Add content to the buffer.
            if (Buffer.isBuffer(this._streams[i])) {
                dataBuffer = Buffer.concat([
                    dataBuffer,
                    this._streams[i]
                ]);
            } else {
                dataBuffer = Buffer.concat([
                    dataBuffer,
                    Buffer.from(this._streams[i])
                ]);
            }
            // Add break after content.
            if (typeof this._streams[i] !== 'string' || this._streams[i].substring(2, boundary.length + 2) !== boundary) {
                dataBuffer = Buffer.concat([
                    dataBuffer,
                    Buffer.from(FormData.LINE_BREAK)
                ]);
            }
        }
    }
    // Add the footer and return the Buffer object.
    return Buffer.concat([
        dataBuffer,
        Buffer.from(this._lastBoundary())
    ]);
};
FormData.prototype._generateBoundary = function() {
    // This generates a 50 character boundary similar to those used by Firefox.
    // They are optimized for boyer-moore parsing.
    this._boundary = '--------------------------' + crypto.randomBytes(12).toString('hex');
};
// Note: getLengthSync DOESN'T calculate streams length
// As workaround one can calculate file size manually and add it as knownLength option
FormData.prototype.getLengthSync = function() {
    var knownLength = this._overheadLength + this._valueLength;
    // Don't get confused, there are 3 "internal" streams for each keyval pair so it basically checks if there is any value added to the form
    if (this._streams.length) {
        knownLength += this._lastBoundary().length;
    }
    // https://github.com/form-data/form-data/issues/40
    if (!this.hasKnownLength()) {
        /*
     * Some async length retrievers are present
     * therefore synchronous length calculation is false.
     * Please use getLength(callback) to get proper length
     */ this._error(new Error('Cannot calculate proper length in synchronous way.'));
    }
    return knownLength;
};
// Public API to check if length of added values is known
// https://github.com/form-data/form-data/issues/196
// https://github.com/form-data/form-data/issues/262
FormData.prototype.hasKnownLength = function() {
    var hasKnownLength = true;
    if (this._valuesToMeasure.length) {
        hasKnownLength = false;
    }
    return hasKnownLength;
};
FormData.prototype.getLength = function(cb) {
    var knownLength = this._overheadLength + this._valueLength;
    if (this._streams.length) {
        knownLength += this._lastBoundary().length;
    }
    if (!this._valuesToMeasure.length) {
        process.nextTick(cb.bind(this, null, knownLength));
        return;
    }
    asynckit.parallel(this._valuesToMeasure, this._lengthRetriever, function(err, values) {
        if (err) {
            cb(err);
            return;
        }
        values.forEach(function(length) {
            knownLength += length;
        });
        cb(null, knownLength);
    });
};
FormData.prototype.submit = function(params, cb) {
    var request;
    var options;
    var defaults = {
        method: 'post'
    };
    // parse provided url if it's string or treat it as options object
    if (typeof params === 'string') {
        params = parseUrl(params); // eslint-disable-line no-param-reassign
        /* eslint sort-keys: 0 */ options = populate({
            port: params.port,
            path: params.pathname,
            host: params.hostname,
            protocol: params.protocol
        }, defaults);
    } else {
        options = populate(params, defaults);
        // if no port provided use default one
        if (!options.port) {
            options.port = options.protocol === 'https:' ? 443 : 80;
        }
    }
    // put that good code in getHeaders to some use
    options.headers = this.getHeaders(params.headers);
    // https if specified, fallback to http in any other case
    if (options.protocol === 'https:') {
        request = https.request(options);
    } else {
        request = http.request(options);
    }
    // get content length and fire away
    this.getLength((function(err, length) {
        if (err && err !== 'Unknown stream') {
            this._error(err);
            return;
        }
        // add content length
        if (length) {
            request.setHeader('Content-Length', length);
        }
        this.pipe(request);
        if (cb) {
            var onResponse;
            var callback = function(error, responce) {
                request.removeListener('error', callback);
                request.removeListener('response', onResponse);
                return cb.call(this, error, responce);
            };
            onResponse = callback.bind(this, null);
            request.on('error', callback);
            request.on('response', onResponse);
        }
    }).bind(this));
    return request;
};
FormData.prototype._error = function(err) {
    if (!this.error) {
        this.error = err;
        this.pause();
        this.emit('error', err);
    }
};
FormData.prototype.toString = function() {
    return '[object FormData]';
};
setToStringTag(FormData.prototype, 'FormData');
// Public API
module.exports = FormData;
}),
"[project]/central-auth/node_modules/form-data/lib/populate.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

// populates missing values
module.exports = function(dst, src) {
    Object.keys(src).forEach(function(prop) {
        dst[prop] = dst[prop] || src[prop]; // eslint-disable-line no-param-reassign
    });
    return dst;
};
}),
"[project]/central-auth/node_modules/function-bind/implementation.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/* eslint no-invalid-this: 1 */ var ERROR_MESSAGE = 'Function.prototype.bind called on incompatible ';
var toStr = Object.prototype.toString;
var max = Math.max;
var funcType = '[object Function]';
var concatty = function concatty(a, b) {
    var arr = [];
    for(var i = 0; i < a.length; i += 1){
        arr[i] = a[i];
    }
    for(var j = 0; j < b.length; j += 1){
        arr[j + a.length] = b[j];
    }
    return arr;
};
var slicy = function slicy(arrLike, offset) {
    var arr = [];
    for(var i = offset || 0, j = 0; i < arrLike.length; i += 1, j += 1){
        arr[j] = arrLike[i];
    }
    return arr;
};
var joiny = function(arr, joiner) {
    var str = '';
    for(var i = 0; i < arr.length; i += 1){
        str += arr[i];
        if (i + 1 < arr.length) {
            str += joiner;
        }
    }
    return str;
};
module.exports = function bind(that) {
    var target = this;
    if (typeof target !== 'function' || toStr.apply(target) !== funcType) {
        throw new TypeError(ERROR_MESSAGE + target);
    }
    var args = slicy(arguments, 1);
    var bound;
    var binder = function() {
        if (this instanceof bound) {
            var result = target.apply(this, concatty(args, arguments));
            if (Object(result) === result) {
                return result;
            }
            return this;
        }
        return target.apply(that, concatty(args, arguments));
    };
    var boundLength = max(0, target.length - args.length);
    var boundArgs = [];
    for(var i = 0; i < boundLength; i++){
        boundArgs[i] = '$' + i;
    }
    bound = Function('binder', 'return function (' + joiny(boundArgs, ',') + '){ return binder.apply(this,arguments); }')(binder);
    if (target.prototype) {
        var Empty = function Empty() {};
        Empty.prototype = target.prototype;
        bound.prototype = new Empty();
        Empty.prototype = null;
    }
    return bound;
};
}),
"[project]/central-auth/node_modules/function-bind/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var implementation = __turbopack_context__.r("[project]/central-auth/node_modules/function-bind/implementation.js [app-route] (ecmascript)");
module.exports = Function.prototype.bind || implementation;
}),
"[project]/central-auth/node_modules/get-intrinsic/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var undefined1;
var $Object = __turbopack_context__.r("[project]/central-auth/node_modules/es-object-atoms/index.js [app-route] (ecmascript)");
var $Error = __turbopack_context__.r("[project]/central-auth/node_modules/es-errors/index.js [app-route] (ecmascript)");
var $EvalError = __turbopack_context__.r("[project]/central-auth/node_modules/es-errors/eval.js [app-route] (ecmascript)");
var $RangeError = __turbopack_context__.r("[project]/central-auth/node_modules/es-errors/range.js [app-route] (ecmascript)");
var $ReferenceError = __turbopack_context__.r("[project]/central-auth/node_modules/es-errors/ref.js [app-route] (ecmascript)");
var $SyntaxError = __turbopack_context__.r("[project]/central-auth/node_modules/es-errors/syntax.js [app-route] (ecmascript)");
var $TypeError = __turbopack_context__.r("[project]/central-auth/node_modules/es-errors/type.js [app-route] (ecmascript)");
var $URIError = __turbopack_context__.r("[project]/central-auth/node_modules/es-errors/uri.js [app-route] (ecmascript)");
var abs = __turbopack_context__.r("[project]/central-auth/node_modules/math-intrinsics/abs.js [app-route] (ecmascript)");
var floor = __turbopack_context__.r("[project]/central-auth/node_modules/math-intrinsics/floor.js [app-route] (ecmascript)");
var max = __turbopack_context__.r("[project]/central-auth/node_modules/math-intrinsics/max.js [app-route] (ecmascript)");
var min = __turbopack_context__.r("[project]/central-auth/node_modules/math-intrinsics/min.js [app-route] (ecmascript)");
var pow = __turbopack_context__.r("[project]/central-auth/node_modules/math-intrinsics/pow.js [app-route] (ecmascript)");
var round = __turbopack_context__.r("[project]/central-auth/node_modules/math-intrinsics/round.js [app-route] (ecmascript)");
var sign = __turbopack_context__.r("[project]/central-auth/node_modules/math-intrinsics/sign.js [app-route] (ecmascript)");
var $Function = Function;
// eslint-disable-next-line consistent-return
var getEvalledConstructor = function(expressionSyntax) {
    try {
        return $Function('"use strict"; return (' + expressionSyntax + ').constructor;')();
    } catch (e) {}
};
var $gOPD = __turbopack_context__.r("[project]/central-auth/node_modules/gopd/index.js [app-route] (ecmascript)");
var $defineProperty = __turbopack_context__.r("[project]/central-auth/node_modules/es-define-property/index.js [app-route] (ecmascript)");
var throwTypeError = function() {
    throw new $TypeError();
};
var ThrowTypeError = $gOPD ? function() {
    try {
        // eslint-disable-next-line no-unused-expressions, no-caller, no-restricted-properties
        arguments.callee; // IE 8 does not throw here
        return throwTypeError;
    } catch (calleeThrows) {
        try {
            // IE 8 throws on Object.getOwnPropertyDescriptor(arguments, '')
            return $gOPD(arguments, 'callee').get;
        } catch (gOPDthrows) {
            return throwTypeError;
        }
    }
}() : throwTypeError;
var hasSymbols = __turbopack_context__.r("[project]/central-auth/node_modules/has-symbols/index.js [app-route] (ecmascript)")();
var getProto = __turbopack_context__.r("[project]/central-auth/node_modules/get-proto/index.js [app-route] (ecmascript)");
var $ObjectGPO = __turbopack_context__.r("[project]/central-auth/node_modules/get-proto/Object.getPrototypeOf.js [app-route] (ecmascript)");
var $ReflectGPO = __turbopack_context__.r("[project]/central-auth/node_modules/get-proto/Reflect.getPrototypeOf.js [app-route] (ecmascript)");
var $apply = __turbopack_context__.r("[project]/central-auth/node_modules/call-bind-apply-helpers/functionApply.js [app-route] (ecmascript)");
var $call = __turbopack_context__.r("[project]/central-auth/node_modules/call-bind-apply-helpers/functionCall.js [app-route] (ecmascript)");
var needsEval = {};
var TypedArray = typeof Uint8Array === 'undefined' || !getProto ? undefined : getProto(Uint8Array);
var INTRINSICS = {
    __proto__: null,
    '%AggregateError%': typeof AggregateError === 'undefined' ? undefined : AggregateError,
    '%Array%': Array,
    '%ArrayBuffer%': typeof ArrayBuffer === 'undefined' ? undefined : ArrayBuffer,
    '%ArrayIteratorPrototype%': hasSymbols && getProto ? getProto([][Symbol.iterator]()) : undefined,
    '%AsyncFromSyncIteratorPrototype%': undefined,
    '%AsyncFunction%': needsEval,
    '%AsyncGenerator%': needsEval,
    '%AsyncGeneratorFunction%': needsEval,
    '%AsyncIteratorPrototype%': needsEval,
    '%Atomics%': typeof Atomics === 'undefined' ? undefined : Atomics,
    '%BigInt%': typeof BigInt === 'undefined' ? undefined : BigInt,
    '%BigInt64Array%': typeof BigInt64Array === 'undefined' ? undefined : BigInt64Array,
    '%BigUint64Array%': typeof BigUint64Array === 'undefined' ? undefined : BigUint64Array,
    '%Boolean%': Boolean,
    '%DataView%': typeof DataView === 'undefined' ? undefined : DataView,
    '%Date%': Date,
    '%decodeURI%': decodeURI,
    '%decodeURIComponent%': decodeURIComponent,
    '%encodeURI%': encodeURI,
    '%encodeURIComponent%': encodeURIComponent,
    '%Error%': $Error,
    '%eval%': eval,
    '%EvalError%': $EvalError,
    '%Float16Array%': typeof Float16Array === 'undefined' ? undefined : Float16Array,
    '%Float32Array%': typeof Float32Array === 'undefined' ? undefined : Float32Array,
    '%Float64Array%': typeof Float64Array === 'undefined' ? undefined : Float64Array,
    '%FinalizationRegistry%': typeof FinalizationRegistry === 'undefined' ? undefined : FinalizationRegistry,
    '%Function%': $Function,
    '%GeneratorFunction%': needsEval,
    '%Int8Array%': typeof Int8Array === 'undefined' ? undefined : Int8Array,
    '%Int16Array%': typeof Int16Array === 'undefined' ? undefined : Int16Array,
    '%Int32Array%': typeof Int32Array === 'undefined' ? undefined : Int32Array,
    '%isFinite%': isFinite,
    '%isNaN%': isNaN,
    '%IteratorPrototype%': hasSymbols && getProto ? getProto(getProto([][Symbol.iterator]())) : undefined,
    '%JSON%': typeof JSON === 'object' ? JSON : undefined,
    '%Map%': typeof Map === 'undefined' ? undefined : Map,
    '%MapIteratorPrototype%': typeof Map === 'undefined' || !hasSymbols || !getProto ? undefined : getProto(new Map()[Symbol.iterator]()),
    '%Math%': Math,
    '%Number%': Number,
    '%Object%': $Object,
    '%Object.getOwnPropertyDescriptor%': $gOPD,
    '%parseFloat%': parseFloat,
    '%parseInt%': parseInt,
    '%Promise%': typeof Promise === 'undefined' ? undefined : Promise,
    '%Proxy%': typeof Proxy === 'undefined' ? undefined : Proxy,
    '%RangeError%': $RangeError,
    '%ReferenceError%': $ReferenceError,
    '%Reflect%': typeof Reflect === 'undefined' ? undefined : Reflect,
    '%RegExp%': RegExp,
    '%Set%': typeof Set === 'undefined' ? undefined : Set,
    '%SetIteratorPrototype%': typeof Set === 'undefined' || !hasSymbols || !getProto ? undefined : getProto(new Set()[Symbol.iterator]()),
    '%SharedArrayBuffer%': typeof SharedArrayBuffer === 'undefined' ? undefined : SharedArrayBuffer,
    '%String%': String,
    '%StringIteratorPrototype%': hasSymbols && getProto ? getProto(''[Symbol.iterator]()) : undefined,
    '%Symbol%': hasSymbols ? Symbol : undefined,
    '%SyntaxError%': $SyntaxError,
    '%ThrowTypeError%': ThrowTypeError,
    '%TypedArray%': TypedArray,
    '%TypeError%': $TypeError,
    '%Uint8Array%': typeof Uint8Array === 'undefined' ? undefined : Uint8Array,
    '%Uint8ClampedArray%': typeof Uint8ClampedArray === 'undefined' ? undefined : Uint8ClampedArray,
    '%Uint16Array%': typeof Uint16Array === 'undefined' ? undefined : Uint16Array,
    '%Uint32Array%': typeof Uint32Array === 'undefined' ? undefined : Uint32Array,
    '%URIError%': $URIError,
    '%WeakMap%': typeof WeakMap === 'undefined' ? undefined : WeakMap,
    '%WeakRef%': typeof WeakRef === 'undefined' ? undefined : WeakRef,
    '%WeakSet%': typeof WeakSet === 'undefined' ? undefined : WeakSet,
    '%Function.prototype.call%': $call,
    '%Function.prototype.apply%': $apply,
    '%Object.defineProperty%': $defineProperty,
    '%Object.getPrototypeOf%': $ObjectGPO,
    '%Math.abs%': abs,
    '%Math.floor%': floor,
    '%Math.max%': max,
    '%Math.min%': min,
    '%Math.pow%': pow,
    '%Math.round%': round,
    '%Math.sign%': sign,
    '%Reflect.getPrototypeOf%': $ReflectGPO
};
if (getProto) {
    try {
        null.error; // eslint-disable-line no-unused-expressions
    } catch (e) {
        // https://github.com/tc39/proposal-shadowrealm/pull/384#issuecomment-1364264229
        var errorProto = getProto(getProto(e));
        INTRINSICS['%Error.prototype%'] = errorProto;
    }
}
var doEval = function doEval(name) {
    var value;
    if (name === '%AsyncFunction%') {
        value = getEvalledConstructor('async function () {}');
    } else if (name === '%GeneratorFunction%') {
        value = getEvalledConstructor('function* () {}');
    } else if (name === '%AsyncGeneratorFunction%') {
        value = getEvalledConstructor('async function* () {}');
    } else if (name === '%AsyncGenerator%') {
        var fn = doEval('%AsyncGeneratorFunction%');
        if (fn) {
            value = fn.prototype;
        }
    } else if (name === '%AsyncIteratorPrototype%') {
        var gen = doEval('%AsyncGenerator%');
        if (gen && getProto) {
            value = getProto(gen.prototype);
        }
    }
    INTRINSICS[name] = value;
    return value;
};
var LEGACY_ALIASES = {
    __proto__: null,
    '%ArrayBufferPrototype%': [
        'ArrayBuffer',
        'prototype'
    ],
    '%ArrayPrototype%': [
        'Array',
        'prototype'
    ],
    '%ArrayProto_entries%': [
        'Array',
        'prototype',
        'entries'
    ],
    '%ArrayProto_forEach%': [
        'Array',
        'prototype',
        'forEach'
    ],
    '%ArrayProto_keys%': [
        'Array',
        'prototype',
        'keys'
    ],
    '%ArrayProto_values%': [
        'Array',
        'prototype',
        'values'
    ],
    '%AsyncFunctionPrototype%': [
        'AsyncFunction',
        'prototype'
    ],
    '%AsyncGenerator%': [
        'AsyncGeneratorFunction',
        'prototype'
    ],
    '%AsyncGeneratorPrototype%': [
        'AsyncGeneratorFunction',
        'prototype',
        'prototype'
    ],
    '%BooleanPrototype%': [
        'Boolean',
        'prototype'
    ],
    '%DataViewPrototype%': [
        'DataView',
        'prototype'
    ],
    '%DatePrototype%': [
        'Date',
        'prototype'
    ],
    '%ErrorPrototype%': [
        'Error',
        'prototype'
    ],
    '%EvalErrorPrototype%': [
        'EvalError',
        'prototype'
    ],
    '%Float32ArrayPrototype%': [
        'Float32Array',
        'prototype'
    ],
    '%Float64ArrayPrototype%': [
        'Float64Array',
        'prototype'
    ],
    '%FunctionPrototype%': [
        'Function',
        'prototype'
    ],
    '%Generator%': [
        'GeneratorFunction',
        'prototype'
    ],
    '%GeneratorPrototype%': [
        'GeneratorFunction',
        'prototype',
        'prototype'
    ],
    '%Int8ArrayPrototype%': [
        'Int8Array',
        'prototype'
    ],
    '%Int16ArrayPrototype%': [
        'Int16Array',
        'prototype'
    ],
    '%Int32ArrayPrototype%': [
        'Int32Array',
        'prototype'
    ],
    '%JSONParse%': [
        'JSON',
        'parse'
    ],
    '%JSONStringify%': [
        'JSON',
        'stringify'
    ],
    '%MapPrototype%': [
        'Map',
        'prototype'
    ],
    '%NumberPrototype%': [
        'Number',
        'prototype'
    ],
    '%ObjectPrototype%': [
        'Object',
        'prototype'
    ],
    '%ObjProto_toString%': [
        'Object',
        'prototype',
        'toString'
    ],
    '%ObjProto_valueOf%': [
        'Object',
        'prototype',
        'valueOf'
    ],
    '%PromisePrototype%': [
        'Promise',
        'prototype'
    ],
    '%PromiseProto_then%': [
        'Promise',
        'prototype',
        'then'
    ],
    '%Promise_all%': [
        'Promise',
        'all'
    ],
    '%Promise_reject%': [
        'Promise',
        'reject'
    ],
    '%Promise_resolve%': [
        'Promise',
        'resolve'
    ],
    '%RangeErrorPrototype%': [
        'RangeError',
        'prototype'
    ],
    '%ReferenceErrorPrototype%': [
        'ReferenceError',
        'prototype'
    ],
    '%RegExpPrototype%': [
        'RegExp',
        'prototype'
    ],
    '%SetPrototype%': [
        'Set',
        'prototype'
    ],
    '%SharedArrayBufferPrototype%': [
        'SharedArrayBuffer',
        'prototype'
    ],
    '%StringPrototype%': [
        'String',
        'prototype'
    ],
    '%SymbolPrototype%': [
        'Symbol',
        'prototype'
    ],
    '%SyntaxErrorPrototype%': [
        'SyntaxError',
        'prototype'
    ],
    '%TypedArrayPrototype%': [
        'TypedArray',
        'prototype'
    ],
    '%TypeErrorPrototype%': [
        'TypeError',
        'prototype'
    ],
    '%Uint8ArrayPrototype%': [
        'Uint8Array',
        'prototype'
    ],
    '%Uint8ClampedArrayPrototype%': [
        'Uint8ClampedArray',
        'prototype'
    ],
    '%Uint16ArrayPrototype%': [
        'Uint16Array',
        'prototype'
    ],
    '%Uint32ArrayPrototype%': [
        'Uint32Array',
        'prototype'
    ],
    '%URIErrorPrototype%': [
        'URIError',
        'prototype'
    ],
    '%WeakMapPrototype%': [
        'WeakMap',
        'prototype'
    ],
    '%WeakSetPrototype%': [
        'WeakSet',
        'prototype'
    ]
};
var bind = __turbopack_context__.r("[project]/central-auth/node_modules/function-bind/index.js [app-route] (ecmascript)");
var hasOwn = __turbopack_context__.r("[project]/central-auth/node_modules/hasown/index.js [app-route] (ecmascript)");
var $concat = bind.call($call, Array.prototype.concat);
var $spliceApply = bind.call($apply, Array.prototype.splice);
var $replace = bind.call($call, String.prototype.replace);
var $strSlice = bind.call($call, String.prototype.slice);
var $exec = bind.call($call, RegExp.prototype.exec);
/* adapted from https://github.com/lodash/lodash/blob/4.17.15/dist/lodash.js#L6735-L6744 */ var rePropName = /[^%.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|%$))/g;
var reEscapeChar = /\\(\\)?/g; /** Used to match backslashes in property paths. */ 
var stringToPath = function stringToPath(string) {
    var first = $strSlice(string, 0, 1);
    var last = $strSlice(string, -1);
    if (first === '%' && last !== '%') {
        throw new $SyntaxError('invalid intrinsic syntax, expected closing `%`');
    } else if (last === '%' && first !== '%') {
        throw new $SyntaxError('invalid intrinsic syntax, expected opening `%`');
    }
    var result = [];
    $replace(string, rePropName, function(match, number, quote, subString) {
        result[result.length] = quote ? $replace(subString, reEscapeChar, '$1') : number || match;
    });
    return result;
};
/* end adaptation */ var getBaseIntrinsic = function getBaseIntrinsic(name, allowMissing) {
    var intrinsicName = name;
    var alias;
    if (hasOwn(LEGACY_ALIASES, intrinsicName)) {
        alias = LEGACY_ALIASES[intrinsicName];
        intrinsicName = '%' + alias[0] + '%';
    }
    if (hasOwn(INTRINSICS, intrinsicName)) {
        var value = INTRINSICS[intrinsicName];
        if (value === needsEval) {
            value = doEval(intrinsicName);
        }
        if (typeof value === 'undefined' && !allowMissing) {
            throw new $TypeError('intrinsic ' + name + ' exists, but is not available. Please file an issue!');
        }
        return {
            alias: alias,
            name: intrinsicName,
            value: value
        };
    }
    throw new $SyntaxError('intrinsic ' + name + ' does not exist!');
};
module.exports = function GetIntrinsic(name, allowMissing) {
    if (typeof name !== 'string' || name.length === 0) {
        throw new $TypeError('intrinsic name must be a non-empty string');
    }
    if (arguments.length > 1 && typeof allowMissing !== 'boolean') {
        throw new $TypeError('"allowMissing" argument must be a boolean');
    }
    if ($exec(/^%?[^%]*%?$/, name) === null) {
        throw new $SyntaxError('`%` may not be present anywhere but at the beginning and end of the intrinsic name');
    }
    var parts = stringToPath(name);
    var intrinsicBaseName = parts.length > 0 ? parts[0] : '';
    var intrinsic = getBaseIntrinsic('%' + intrinsicBaseName + '%', allowMissing);
    var intrinsicRealName = intrinsic.name;
    var value = intrinsic.value;
    var skipFurtherCaching = false;
    var alias = intrinsic.alias;
    if (alias) {
        intrinsicBaseName = alias[0];
        $spliceApply(parts, $concat([
            0,
            1
        ], alias));
    }
    for(var i = 1, isOwn = true; i < parts.length; i += 1){
        var part = parts[i];
        var first = $strSlice(part, 0, 1);
        var last = $strSlice(part, -1);
        if ((first === '"' || first === "'" || first === '`' || last === '"' || last === "'" || last === '`') && first !== last) {
            throw new $SyntaxError('property names with quotes must have matching quotes');
        }
        if (part === 'constructor' || !isOwn) {
            skipFurtherCaching = true;
        }
        intrinsicBaseName += '.' + part;
        intrinsicRealName = '%' + intrinsicBaseName + '%';
        if (hasOwn(INTRINSICS, intrinsicRealName)) {
            value = INTRINSICS[intrinsicRealName];
        } else if (value != null) {
            if (!(part in value)) {
                if (!allowMissing) {
                    throw new $TypeError('base intrinsic for ' + name + ' exists, but the property is not available.');
                }
                return void undefined;
            }
            if ($gOPD && i + 1 >= parts.length) {
                var desc = $gOPD(value, part);
                isOwn = !!desc;
                // By convention, when a data property is converted to an accessor
                // property to emulate a data property that does not suffer from
                // the override mistake, that accessor's getter is marked with
                // an `originalValue` property. Here, when we detect this, we
                // uphold the illusion by pretending to see that original data
                // property, i.e., returning the value rather than the getter
                // itself.
                if (isOwn && 'get' in desc && !('originalValue' in desc.get)) {
                    value = desc.get;
                } else {
                    value = value[part];
                }
            } else {
                isOwn = hasOwn(value, part);
                value = value[part];
            }
            if (isOwn && !skipFurtherCaching) {
                INTRINSICS[intrinsicRealName] = value;
            }
        }
    }
    return value;
};
}),
"[project]/central-auth/node_modules/get-proto/Object.getPrototypeOf.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var $Object = __turbopack_context__.r("[project]/central-auth/node_modules/es-object-atoms/index.js [app-route] (ecmascript)");
/** @type {import('./Object.getPrototypeOf')} */ module.exports = $Object.getPrototypeOf || null;
}),
"[project]/central-auth/node_modules/get-proto/Reflect.getPrototypeOf.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('./Reflect.getPrototypeOf')} */ module.exports = typeof Reflect !== 'undefined' && Reflect.getPrototypeOf || null;
}),
"[project]/central-auth/node_modules/get-proto/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var reflectGetProto = __turbopack_context__.r("[project]/central-auth/node_modules/get-proto/Reflect.getPrototypeOf.js [app-route] (ecmascript)");
var originalGetProto = __turbopack_context__.r("[project]/central-auth/node_modules/get-proto/Object.getPrototypeOf.js [app-route] (ecmascript)");
var getDunderProto = __turbopack_context__.r("[project]/central-auth/node_modules/dunder-proto/get.js [app-route] (ecmascript)");
/** @type {import('.')} */ module.exports = reflectGetProto ? function getProto(O) {
    // @ts-expect-error TS can't narrow inside a closure, for some reason
    return reflectGetProto(O);
} : originalGetProto ? function getProto(O) {
    if (!O || typeof O !== 'object' && typeof O !== 'function') {
        throw new TypeError('getProto: not an object');
    }
    // @ts-expect-error TS can't narrow inside a closure, for some reason
    return originalGetProto(O);
} : getDunderProto ? function getProto(O) {
    // @ts-expect-error TS can't narrow inside a closure, for some reason
    return getDunderProto(O);
} : null;
}),
"[project]/central-auth/node_modules/gopd/gOPD.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('./gOPD')} */ module.exports = Object.getOwnPropertyDescriptor;
}),
"[project]/central-auth/node_modules/gopd/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('.')} */ var $gOPD = __turbopack_context__.r("[project]/central-auth/node_modules/gopd/gOPD.js [app-route] (ecmascript)");
if ($gOPD) {
    try {
        $gOPD([], 'length');
    } catch (e) {
        // IE 8 has a broken gOPD
        $gOPD = null;
    }
}
module.exports = $gOPD;
}),
"[project]/central-auth/node_modules/has-flag/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

module.exports = (flag, argv = process.argv)=>{
    const prefix = flag.startsWith('-') ? '' : flag.length === 1 ? '-' : '--';
    const position = argv.indexOf(prefix + flag);
    const terminatorPosition = argv.indexOf('--');
    return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
};
}),
"[project]/central-auth/node_modules/has-symbols/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var origSymbol = typeof Symbol !== 'undefined' && Symbol;
var hasSymbolSham = __turbopack_context__.r("[project]/central-auth/node_modules/has-symbols/shams.js [app-route] (ecmascript)");
/** @type {import('.')} */ module.exports = function hasNativeSymbols() {
    if (typeof origSymbol !== 'function') {
        return false;
    }
    if (typeof Symbol !== 'function') {
        return false;
    }
    if (typeof origSymbol('foo') !== 'symbol') {
        return false;
    }
    if (typeof Symbol('bar') !== 'symbol') {
        return false;
    }
    return hasSymbolSham();
};
}),
"[project]/central-auth/node_modules/has-symbols/shams.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('./shams')} */ /* eslint complexity: [2, 18], max-statements: [2, 33] */ module.exports = function hasSymbols() {
    if (typeof Symbol !== 'function' || typeof Object.getOwnPropertySymbols !== 'function') {
        return false;
    }
    if (typeof Symbol.iterator === 'symbol') {
        return true;
    }
    /** @type {{ [k in symbol]?: unknown }} */ var obj = {};
    var sym = Symbol('test');
    var symObj = Object(sym);
    if (typeof sym === 'string') {
        return false;
    }
    if (Object.prototype.toString.call(sym) !== '[object Symbol]') {
        return false;
    }
    if (Object.prototype.toString.call(symObj) !== '[object Symbol]') {
        return false;
    }
    // temp disabled per https://github.com/ljharb/object.assign/issues/17
    // if (sym instanceof Symbol) { return false; }
    // temp disabled per https://github.com/WebReflection/get-own-property-symbols/issues/4
    // if (!(symObj instanceof Symbol)) { return false; }
    // if (typeof Symbol.prototype.toString !== 'function') { return false; }
    // if (String(sym) !== Symbol.prototype.toString.call(sym)) { return false; }
    var symVal = 42;
    obj[sym] = symVal;
    for(var _ in obj){
        return false;
    } // eslint-disable-line no-restricted-syntax, no-unreachable-loop
    if (typeof Object.keys === 'function' && Object.keys(obj).length !== 0) {
        return false;
    }
    if (typeof Object.getOwnPropertyNames === 'function' && Object.getOwnPropertyNames(obj).length !== 0) {
        return false;
    }
    var syms = Object.getOwnPropertySymbols(obj);
    if (syms.length !== 1 || syms[0] !== sym) {
        return false;
    }
    if (!Object.prototype.propertyIsEnumerable.call(obj, sym)) {
        return false;
    }
    if (typeof Object.getOwnPropertyDescriptor === 'function') {
        // eslint-disable-next-line no-extra-parens
        var descriptor = Object.getOwnPropertyDescriptor(obj, sym);
        if (descriptor.value !== symVal || descriptor.enumerable !== true) {
            return false;
        }
    }
    return true;
};
}),
"[project]/central-auth/node_modules/has-tostringtag/shams.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var hasSymbols = __turbopack_context__.r("[project]/central-auth/node_modules/has-symbols/shams.js [app-route] (ecmascript)");
/** @type {import('.')} */ module.exports = function hasToStringTagShams() {
    return hasSymbols() && !!Symbol.toStringTag;
};
}),
"[project]/central-auth/node_modules/hasown/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var call = Function.prototype.call;
var $hasOwn = Object.prototype.hasOwnProperty;
var bind = __turbopack_context__.r("[project]/central-auth/node_modules/function-bind/index.js [app-route] (ecmascript)");
/** @type {import('.')} */ module.exports = bind.call(call, $hasOwn);
}),
"[project]/central-auth/node_modules/http-vary/dist/index.mjs [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "compare",
    ()=>t,
    "parse",
    ()=>o
]);
function r(r, e) {
    (null == e || e > r.length) && (e = r.length);
    for(var t = 0, n = Array(e); t < e; t++)n[t] = r[t];
    return n;
}
function e(e, t) {
    var n = "undefined" != typeof Symbol && e[Symbol.iterator] || e["@@iterator"];
    if (n) return (n = n.call(e)).next.bind(n);
    if (Array.isArray(e) || (n = function(e, t) {
        if (e) {
            if ("string" == typeof e) return r(e, t);
            var n = ({}).toString.call(e).slice(8, -1);
            return "Object" === n && e.constructor && (n = e.constructor.name), "Map" === n || "Set" === n ? Array.from(e) : "Arguments" === n || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n) ? r(e, t) : void 0;
        }
    }(e)) || t && e && "number" == typeof e.length) {
        n && (e = n);
        var o = 0;
        return function() {
            return o >= e.length ? {
                done: !0
            } : {
                done: !1,
                value: e[o++]
            };
        };
    }
    throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function t(r, t, n) {
    if ("*" === r || null === r) return !1;
    for(var o, a = Object.keys(t), i = Object.keys(n), l = e(r); !(o = l()).done;){
        for(var u, f = o.value, v = void 0, d = void 0, s = e(a); !(u = s()).done;){
            var c = u.value;
            if (c.toLowerCase() === f) {
                var y;
                v = null == (y = t[c]) || null == (y = y.toString()) ? void 0 : y.trim();
                break;
            }
        }
        for(var b, m = e(i); !(b = m()).done;){
            var g = b.value;
            if (g.toLowerCase() === f) {
                var h;
                d = null == (h = n[g]) || null == (h = h.toString()) ? void 0 : h.trim();
                break;
            }
        }
        if (v != d) return !1;
    }
    return !0;
}
var n = /^[a-z0-9-]+$/i;
function o(r, e) {
    if (void 0 === e && (e = 16), "string" != typeof r) return null;
    if (r.includes("*")) return "*";
    for(var t = new Set, o = 0; o < r.length; o++){
        var a = r[o];
        if (" " !== a && "\t" !== a && "," !== a) {
            for(var i = o; o < r.length && "," !== r[o];)o++;
            var l = r.slice(i, o).trim().toLowerCase();
            if (0 !== l.length && n.test(l) && (t.add(l), t.size >= e)) break;
        }
    }
    return 0 === t.size ? null : Array.from(t);
}
;
}),
"[project]/central-auth/node_modules/https-proxy-agent/dist/agent.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __awaiter = /*TURBOPACK member replacement*/ __turbopack_context__.e && /*TURBOPACK member replacement*/ __turbopack_context__.e.__awaiter || function(thisArg, _arguments, P, generator) {
    function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
            resolve(value);
        });
    }
    return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
            try {
                step(generator.next(value));
            } catch (e) {
                reject(e);
            }
        }
        function rejected(value) {
            try {
                step(generator["throw"](value));
            } catch (e) {
                reject(e);
            }
        }
        function step(result) {
            result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = /*TURBOPACK member replacement*/ __turbopack_context__.e && /*TURBOPACK member replacement*/ __turbopack_context__.e.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : {
        "default": mod
    };
};
Object.defineProperty(exports, "__esModule", {
    value: true
});
const net_1 = __importDefault(__turbopack_context__.r("[externals]/net [external] (net, cjs)"));
const tls_1 = __importDefault(__turbopack_context__.r("[externals]/tls [external] (tls, cjs)"));
const url_1 = __importDefault(__turbopack_context__.r("[externals]/url [external] (url, cjs)"));
const assert_1 = __importDefault(__turbopack_context__.r("[externals]/assert [external] (assert, cjs)"));
const debug_1 = __importDefault(__turbopack_context__.r("[project]/central-auth/node_modules/debug/src/index.js [app-route] (ecmascript)"));
const agent_base_1 = __turbopack_context__.r("[project]/central-auth/node_modules/agent-base/dist/src/index.js [app-route] (ecmascript)");
const parse_proxy_response_1 = __importDefault(__turbopack_context__.r("[project]/central-auth/node_modules/https-proxy-agent/dist/parse-proxy-response.js [app-route] (ecmascript)"));
const debug = debug_1.default('https-proxy-agent:agent');
/**
 * The `HttpsProxyAgent` implements an HTTP Agent subclass that connects to
 * the specified "HTTP(s) proxy server" in order to proxy HTTPS requests.
 *
 * Outgoing HTTP requests are first tunneled through the proxy server using the
 * `CONNECT` HTTP request method to establish a connection to the proxy server,
 * and then the proxy server connects to the destination target and issues the
 * HTTP request from the proxy server.
 *
 * `https:` requests have their socket connection upgraded to TLS once
 * the connection to the proxy server has been established.
 *
 * @api public
 */ class HttpsProxyAgent extends agent_base_1.Agent {
    constructor(_opts){
        let opts;
        if (typeof _opts === 'string') {
            opts = url_1.default.parse(_opts);
        } else {
            opts = _opts;
        }
        if (!opts) {
            throw new Error('an HTTP(S) proxy server `host` and `port` must be specified!');
        }
        debug('creating new HttpsProxyAgent instance: %o', opts);
        super(opts);
        const proxy = Object.assign({}, opts);
        // If `true`, then connect to the proxy server over TLS.
        // Defaults to `false`.
        this.secureProxy = opts.secureProxy || isHTTPS(proxy.protocol);
        // Prefer `hostname` over `host`, and set the `port` if needed.
        proxy.host = proxy.hostname || proxy.host;
        if (typeof proxy.port === 'string') {
            proxy.port = parseInt(proxy.port, 10);
        }
        if (!proxy.port && proxy.host) {
            proxy.port = this.secureProxy ? 443 : 80;
        }
        // ALPN is supported by Node.js >= v5.
        // attempt to negotiate http/1.1 for proxy servers that support http/2
        if (this.secureProxy && !('ALPNProtocols' in proxy)) {
            proxy.ALPNProtocols = [
                'http 1.1'
            ];
        }
        if (proxy.host && proxy.path) {
            // If both a `host` and `path` are specified then it's most likely
            // the result of a `url.parse()` call... we need to remove the
            // `path` portion so that `net.connect()` doesn't attempt to open
            // that as a Unix socket file.
            delete proxy.path;
            delete proxy.pathname;
        }
        this.proxy = proxy;
    }
    /**
     * Called when the node-core HTTP client library is creating a
     * new HTTP request.
     *
     * @api protected
     */ callback(req, opts) {
        return __awaiter(this, void 0, void 0, function*() {
            const { proxy, secureProxy } = this;
            // Create a socket connection to the proxy server.
            let socket;
            if (secureProxy) {
                debug('Creating `tls.Socket`: %o', proxy);
                socket = tls_1.default.connect(proxy);
            } else {
                debug('Creating `net.Socket`: %o', proxy);
                socket = net_1.default.connect(proxy);
            }
            const headers = Object.assign({}, proxy.headers);
            const hostname = `${opts.host}:${opts.port}`;
            let payload = `CONNECT ${hostname} HTTP/1.1\r\n`;
            // Inject the `Proxy-Authorization` header if necessary.
            if (proxy.auth) {
                headers['Proxy-Authorization'] = `Basic ${Buffer.from(proxy.auth).toString('base64')}`;
            }
            // The `Host` header should only include the port
            // number when it is not the default port.
            let { host, port, secureEndpoint } = opts;
            if (!isDefaultPort(port, secureEndpoint)) {
                host += `:${port}`;
            }
            headers.Host = host;
            headers.Connection = 'close';
            for (const name of Object.keys(headers)){
                payload += `${name}: ${headers[name]}\r\n`;
            }
            const proxyResponsePromise = parse_proxy_response_1.default(socket);
            socket.write(`${payload}\r\n`);
            const { statusCode, buffered } = yield proxyResponsePromise;
            if (statusCode === 200) {
                req.once('socket', resume);
                if (opts.secureEndpoint) {
                    // The proxy is connecting to a TLS server, so upgrade
                    // this socket connection to a TLS connection.
                    debug('Upgrading socket connection to TLS');
                    const servername = opts.servername || opts.host;
                    return tls_1.default.connect(Object.assign(Object.assign({}, omit(opts, 'host', 'hostname', 'path', 'port')), {
                        socket,
                        servername
                    }));
                }
                return socket;
            }
            // Some other status code that's not 200... need to re-play the HTTP
            // header "data" events onto the socket once the HTTP machinery is
            // attached so that the node core `http` can parse and handle the
            // error status code.
            // Close the original socket, and a new "fake" socket is returned
            // instead, so that the proxy doesn't get the HTTP request
            // written to it (which may contain `Authorization` headers or other
            // sensitive data).
            //
            // See: https://hackerone.com/reports/541502
            socket.destroy();
            const fakeSocket = new net_1.default.Socket({
                writable: false
            });
            fakeSocket.readable = true;
            // Need to wait for the "socket" event to re-play the "data" events.
            req.once('socket', (s)=>{
                debug('replaying proxy buffer for failed request');
                assert_1.default(s.listenerCount('data') > 0);
                // Replay the "buffered" Buffer onto the fake `socket`, since at
                // this point the HTTP module machinery has been hooked up for
                // the user.
                s.push(buffered);
                s.push(null);
            });
            return fakeSocket;
        });
    }
}
exports.default = HttpsProxyAgent;
function resume(socket) {
    socket.resume();
}
function isDefaultPort(port, secure) {
    return Boolean(!secure && port === 80 || secure && port === 443);
}
function isHTTPS(protocol) {
    return typeof protocol === 'string' ? /^https:?$/i.test(protocol) : false;
}
function omit(obj, ...keys) {
    const ret = {};
    let key;
    for(key in obj){
        if (!keys.includes(key)) {
            ret[key] = obj[key];
        }
    }
    return ret;
}
}),
"[project]/central-auth/node_modules/https-proxy-agent/dist/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __importDefault = /*TURBOPACK member replacement*/ __turbopack_context__.e && /*TURBOPACK member replacement*/ __turbopack_context__.e.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : {
        "default": mod
    };
};
const agent_1 = __importDefault(__turbopack_context__.r("[project]/central-auth/node_modules/https-proxy-agent/dist/agent.js [app-route] (ecmascript)"));
function createHttpsProxyAgent(opts) {
    return new agent_1.default(opts);
}
(function(createHttpsProxyAgent) {
    createHttpsProxyAgent.HttpsProxyAgent = agent_1.default;
    createHttpsProxyAgent.prototype = agent_1.default.prototype;
})(createHttpsProxyAgent || (createHttpsProxyAgent = {}));
module.exports = createHttpsProxyAgent;
}),
"[project]/central-auth/node_modules/https-proxy-agent/dist/parse-proxy-response.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __importDefault = /*TURBOPACK member replacement*/ __turbopack_context__.e && /*TURBOPACK member replacement*/ __turbopack_context__.e.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : {
        "default": mod
    };
};
Object.defineProperty(exports, "__esModule", {
    value: true
});
const debug_1 = __importDefault(__turbopack_context__.r("[project]/central-auth/node_modules/debug/src/index.js [app-route] (ecmascript)"));
const debug = debug_1.default('https-proxy-agent:parse-proxy-response');
function parseProxyResponse(socket) {
    return new Promise((resolve, reject)=>{
        // we need to buffer any HTTP traffic that happens with the proxy before we get
        // the CONNECT response, so that if the response is anything other than an "200"
        // response code, then we can re-play the "data" events on the socket once the
        // HTTP parser is hooked up...
        let buffersLength = 0;
        const buffers = [];
        function read() {
            const b = socket.read();
            if (b) ondata(b);
            else socket.once('readable', read);
        }
        function cleanup() {
            socket.removeListener('end', onend);
            socket.removeListener('error', onerror);
            socket.removeListener('close', onclose);
            socket.removeListener('readable', read);
        }
        function onclose(err) {
            debug('onclose had error %o', err);
        }
        function onend() {
            debug('onend');
        }
        function onerror(err) {
            cleanup();
            debug('onerror %o', err);
            reject(err);
        }
        function ondata(b) {
            buffers.push(b);
            buffersLength += b.length;
            const buffered = Buffer.concat(buffers, buffersLength);
            const endOfHeaders = buffered.indexOf('\r\n\r\n');
            if (endOfHeaders === -1) {
                // keep buffering
                debug('have not received end of HTTP headers yet...');
                read();
                return;
            }
            const firstLine = buffered.toString('ascii', 0, buffered.indexOf('\r\n'));
            const statusCode = +firstLine.split(' ')[1];
            debug('got proxy server response: %o', firstLine);
            resolve({
                statusCode,
                buffered
            });
        }
        socket.on('error', onerror);
        socket.on('close', onclose);
        socket.on('end', onend);
        read();
    });
}
exports.default = parseProxyResponse;
}),
"[project]/central-auth/node_modules/jose/dist/webapi/jwt/decrypt.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "jwtDecrypt",
    ()=>jwtDecrypt
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$jwe_decrypt$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/jose/dist/webapi/lib/jwe_decrypt.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$jwt_claims_set$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/jose/dist/webapi/lib/jwt_claims_set.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/jose/dist/webapi/util/errors.js [app-route] (ecmascript)");
;
;
;
async function jwtDecrypt(jwt, key, options) {
    const { plaintext, ...result } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$jwe_decrypt$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["decryptCompact"])(jwt, (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$jwe_decrypt$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prepareDecrypt"])(options), key), { protectedHeader } = result, payload = (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$jwt_claims_set$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["validateClaimsSet"])(protectedHeader, plaintext, options);
    for (const claim of [
        "iss",
        "sub",
        "aud"
    ])if (protectedHeader[claim] !== void 0 && (claim === "aud" ? JSON.stringify(protectedHeader.aud) !== JSON.stringify(payload.aud) : protectedHeader[claim] !== payload[claim])) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWTClaimValidationFailed"](`replicated "${claim}" claim header parameter mismatch`, payload, claim, "mismatch");
    return {
        payload,
        ...result
    };
}
;
}),
"[project]/central-auth/node_modules/jose/dist/webapi/lib/buffer_utils.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "concat",
    ()=>concat,
    "decodeBase64",
    ()=>decodeBase64,
    "decoder",
    ()=>decoder,
    "digest",
    ()=>digest,
    "encode",
    ()=>encode,
    "encodeBase64",
    ()=>encodeBase64,
    "encoder",
    ()=>encoder,
    "strictDecoder",
    ()=>strictDecoder,
    "uint32be",
    ()=>uint32be,
    "uint64be",
    ()=>uint64be
]);
const encoder = new TextEncoder(), decoder = new TextDecoder(), strictDecoder = new TextDecoder("utf-8", {
    fatal: !0
}), UINT32_RANGE = 2 ** 32;
function concat(...buffers) {
    const size = buffers.reduce((acc, { length })=>acc + length, 0), buf = new Uint8Array(size);
    let i = 0;
    for (const buffer of buffers)buf.set(buffer, i), i += buffer.length;
    return buf;
}
function writeUInt32BE(buf, value, offset) {
    if (value < 0 || value >= UINT32_RANGE) throw new RangeError(`value must be >= 0 and <= ${UINT32_RANGE - 1}. Received ${value}`);
    buf.set([
        value >>> 24,
        value >>> 16,
        value >>> 8,
        value & 255
    ], offset);
}
function uint64be(value) {
    const high = Math.floor(value / UINT32_RANGE), low = value % UINT32_RANGE, buf = new Uint8Array(8);
    return writeUInt32BE(buf, high, 0), writeUInt32BE(buf, low, 4), buf;
}
function uint32be(value) {
    const buf = new Uint8Array(4);
    return writeUInt32BE(buf, value), buf;
}
const NON_ASCII = /[^\x00-\x7f]/;
function encode(string) {
    if (typeof string == "string" && string.length >= 128) {
        if (NON_ASCII.test(string)) throw new TypeError("non-ASCII string encountered in encode()");
        return encoder.encode(string);
    }
    const bytes = new Uint8Array(string.length);
    for(let i = 0; i < string.length; i++){
        const code = string.charCodeAt(i);
        if (code > 127) throw new TypeError("non-ASCII string encountered in encode()");
        bytes[i] = code;
    }
    return bytes;
}
function encodeBase64(input, url = !1) {
    if (Uint8Array.prototype.toBase64) return input.toBase64({
        alphabet: url ? "base64url" : "base64",
        omitPadding: url
    });
    const CHUNK_SIZE = 32768, arr = [];
    for(let i = 0; i < input.length; i += CHUNK_SIZE)arr.push(String.fromCharCode.apply(null, input.subarray(i, i + CHUNK_SIZE)));
    const encoded = btoa(arr.join(""));
    return url ? encoded.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_") : encoded;
}
function decodeBase64(encoded, url = !1) {
    if (Uint8Array.fromBase64) return Uint8Array.fromBase64(encoded, {
        alphabet: url ? "base64url" : "base64"
    });
    if (url) {
        if (encoded.includes("+") || encoded.includes("/")) throw new TypeError("Invalid base64url");
        encoded = encoded.replace(/-/g, "+").replace(/_/g, "/");
    }
    const binary = atob(encoded), bytes = new Uint8Array(binary.length);
    for(let i = 0; i < binary.length; i++)bytes[i] = binary.charCodeAt(i);
    return bytes;
}
async function digest(algorithm, data) {
    const subtleDigest = `SHA-${algorithm.slice(-3)}`;
    return new Uint8Array(await crypto.subtle.digest(subtleDigest, data));
}
;
}),
"[project]/central-auth/node_modules/jose/dist/webapi/lib/content_encryption.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "checkCekLength",
    ()=>checkCekLength,
    "checkIvLength",
    ()=>checkIvLength,
    "decrypt",
    ()=>decrypt,
    "encrypt",
    ()=>encrypt,
    "generateCek",
    ()=>generateCek,
    "generateIv",
    ()=>generateIv
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$buffer_utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/jose/dist/webapi/lib/buffer_utils.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$key$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/jose/dist/webapi/lib/key.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/jose/dist/webapi/util/errors.js [app-route] (ecmascript)");
;
;
;
const generateCek = (enc)=>crypto.getRandomValues(new Uint8Array(enc.cekBits >> 3));
function checkCekLength(cek, expected) {
    const actual = cek.byteLength << 3;
    if (actual !== expected) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"](`Invalid Content Encryption Key length. Expected ${expected} bits, got ${actual} bits`);
}
const generateIv = (enc)=>crypto.getRandomValues(new Uint8Array(enc.ivBits >> 3));
function checkIvLength(enc, iv) {
    if (iv.length << 3 !== enc.ivBits) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]("Invalid Initialization Vector length");
}
async function cbcKeySetup(enc, cek, usage) {
    if (!(cek instanceof Uint8Array)) throw new TypeError((0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$key$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["invalidKeyInput"])(cek, "Uint8Array"));
    const keyLengthBits = enc.cekBits >> 1, encKey = await crypto.subtle.importKey("raw", cek.subarray(keyLengthBits >> 3), "AES-CBC", !1, [
        usage
    ]), macKey = await crypto.subtle.importKey("raw", cek.subarray(0, keyLengthBits >> 3), {
        hash: `SHA-${keyLengthBits << 1}`,
        name: "HMAC"
    }, !1, [
        "sign"
    ]);
    return [
        encKey,
        macKey,
        keyLengthBits
    ];
}
async function cbcHmacTag(macKey, macData, keyLengthBits) {
    return new Uint8Array((await crypto.subtle.sign("HMAC", macKey, macData)).slice(0, keyLengthBits >> 3));
}
async function cbcEncrypt(enc, plaintext, cek, iv, aad) {
    const [encKey, macKey, keyLengthBits] = await cbcKeySetup(enc, cek, "encrypt"), ciphertext = new Uint8Array(await crypto.subtle.encrypt({
        iv,
        name: "AES-CBC"
    }, encKey, plaintext)), al = (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$buffer_utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["uint64be"])(aad.length * 8), macData = (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$buffer_utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["concat"])(aad, iv, ciphertext, al), tag = await cbcHmacTag(macKey, macData, keyLengthBits);
    return {
        ciphertext,
        tag,
        iv
    };
}
async function timingSafeEqual(a, b) {
    const algorithm = {
        name: "HMAC",
        hash: "SHA-256"
    }, key = await crypto.subtle.generateKey(algorithm, !1, [
        "sign",
        "verify"
    ]), aHmac = await crypto.subtle.sign(algorithm, key, a);
    return crypto.subtle.verify(algorithm, key, aHmac, b);
}
async function cbcDecrypt(enc, cek, ciphertext, iv, tag, aad) {
    const [encKey, macKey, keyLengthBits] = await cbcKeySetup(enc, cek, "decrypt"), al = (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$buffer_utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["uint64be"])(aad.length * 8), macData = (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$buffer_utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["concat"])(aad, iv, ciphertext, al), expectedTag = await cbcHmacTag(macKey, macData, keyLengthBits);
    try {
        if (await timingSafeEqual(tag, expectedTag)) return new Uint8Array(await crypto.subtle.decrypt({
            iv,
            name: "AES-CBC"
        }, encKey, ciphertext));
    } catch  {}
    throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEDecryptionFailed"]();
}
async function encrypt(enc, plaintext, cek, iv, aad) {
    if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$key$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isCryptoKey"])(cek) && !(cek instanceof Uint8Array)) throw new TypeError((0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$key$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["invalidKeyInput"])(cek, "CryptoKey", "KeyObject", "Uint8Array", "JSON Web Key"));
    if (iv ? checkIvLength(enc, iv) : iv = generateIv(enc), cek instanceof Uint8Array && checkCekLength(cek, enc.cekBits), enc.cbc) return cbcEncrypt(enc, plaintext, cek, iv, aad);
    const encKey = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$key$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["rawKey"])(cek, enc.subtle, "encrypt"), encrypted = new Uint8Array(await crypto.subtle.encrypt({
        additionalData: aad,
        iv,
        name: "AES-GCM",
        tagLength: 128
    }, encKey, plaintext));
    return {
        ciphertext: encrypted.subarray(0, -16),
        tag: encrypted.subarray(-16),
        iv
    };
}
async function decrypt(enc, cek, ciphertext, iv, tag, aad) {
    if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$key$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isCryptoKey"])(cek) && !(cek instanceof Uint8Array)) throw new TypeError((0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$key$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["invalidKeyInput"])(cek, "CryptoKey", "KeyObject", "Uint8Array", "JSON Web Key"));
    if (!iv) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]("JWE Initialization Vector missing");
    if (!tag) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]("JWE Authentication Tag missing");
    if (!enc.cbc && tag.length !== 16) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]("Invalid Authentication Tag length");
    if (checkIvLength(enc, iv), cek instanceof Uint8Array && checkCekLength(cek, enc.cekBits), enc.cbc) return cbcDecrypt(enc, cek, ciphertext, iv, tag, aad);
    const encKey = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$key$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["rawKey"])(cek, enc.subtle, "decrypt");
    try {
        return new Uint8Array(await crypto.subtle.decrypt({
            additionalData: aad,
            iv,
            name: "AES-GCM",
            tagLength: 128
        }, encKey, (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$buffer_utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["concat"])(ciphertext, tag)));
    } catch  {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEDecryptionFailed"]();
    }
}
;
}),
"[project]/central-auth/node_modules/jose/dist/webapi/lib/deflate.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "compress",
    ()=>compress,
    "decompress",
    ()=>decompress,
    "validateZip",
    ()=>validateZip
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/jose/dist/webapi/util/errors.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$buffer_utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/jose/dist/webapi/lib/buffer_utils.js [app-route] (ecmascript)");
;
;
function validateZip(joseHeader, protectedHeader) {
    if (joseHeader.zip !== void 0 && joseHeader.zip !== "DEF") throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JOSENotSupported"]('Unsupported JWE "zip" (Compression Algorithm) Header Parameter value.');
    if (joseHeader.zip !== void 0 && !protectedHeader?.zip) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]('JWE "zip" (Compression Algorithm) Header Parameter MUST be in a protected header.');
}
function supported(name) {
    if (typeof globalThis[name] > "u") throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JOSENotSupported"](`JWE "zip" (Compression Algorithm) Header Parameter requires the ${name} API.`);
}
async function transform(stream, input, maxLength = 1 / 0) {
    const writer = stream.writable.getWriter();
    writer.write(input).catch(()=>{}), writer.close().catch(()=>{});
    const chunks = [];
    let length = 0;
    const reader = stream.readable.getReader();
    for(;;){
        const { value, done } = await reader.read();
        if (done) break;
        if (chunks.push(value), length += value.byteLength, maxLength !== 1 / 0 && length > maxLength) throw await reader.cancel().catch(()=>{}), new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]("Decompressed plaintext exceeded the configured limit");
    }
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$buffer_utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["concat"])(...chunks);
}
async function compress(input) {
    return supported("CompressionStream"), transform(new CompressionStream("deflate-raw"), input);
}
async function decompress(input, maxLength) {
    return supported("DecompressionStream"), transform(new DecompressionStream("deflate-raw"), input, maxLength);
}
;
}),
"[project]/central-auth/node_modules/jose/dist/webapi/lib/jwe_algorithms.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "JWE",
    ()=>JWE,
    "isJWECEKTransport",
    ()=>isJWECEKTransport,
    "jweAlgorithm",
    ()=>jweAlgorithm,
    "jweEncryption",
    ()=>jweEncryption
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/jose/dist/webapi/util/errors.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$key_descriptor$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/jose/dist/webapi/lib/key_descriptor.js [app-route] (ecmascript)");
;
;
const wrap = [
    [
        "encrypt",
        "wrapKey"
    ],
    [
        "decrypt",
        "unwrapKey"
    ]
], derive = [
    [],
    [
        "deriveBits"
    ]
], none = [
    [],
    []
];
function rsaes(bits) {
    return {
        kty: [
            "RSA"
        ],
        mode: "key-encryption",
        subtle: {
            name: "RSA-OAEP",
            hash: `SHA-${bits}`
        },
        usages: wrap,
        ops: [
            "wrapKey",
            "unwrapKey"
        ]
    };
}
function ecdh(mode) {
    return {
        kty: [
            "EC",
            "OKP"
        ],
        mode,
        subtle: {
            name: "ECDH"
        },
        resolve: ({ kty, crv, asymmetricKeyType })=>{
            if (crv === "X25519" || asymmetricKeyType === "x25519") return {
                name: "X25519"
            };
            if (kty === "OKP") throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JOSENotSupported"]('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
            return {
                name: "ECDH",
                namedCurve: crv
            };
        },
        usages: derive,
        ops: [
            void 0,
            "deriveBits"
        ]
    };
}
function aeskw(bits, gcm = !1) {
    return {
        kty: [
            "oct"
        ],
        mode: "key-wrapping",
        secret: !0,
        subtle: {
            name: gcm ? "AES-GCM" : "AES-KW",
            length: bits
        },
        usages: none,
        ops: gcm ? [
            "encrypt",
            "decrypt"
        ] : [
            "wrapKey",
            "unwrapKey"
        ]
    };
}
function pbes2() {
    return {
        kty: [
            "oct"
        ],
        mode: "key-wrapping",
        secret: !0,
        subtle: {
            name: "PBKDF2"
        },
        usages: none,
        ops: [
            "deriveBits",
            "deriveBits"
        ]
    };
}
const JWE = (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$key_descriptor$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["table"])({
    dir: {
        kty: [
            "oct"
        ],
        mode: "direct-encryption",
        secret: !0,
        subtle: {
            name: "AES-GCM"
        },
        usages: none,
        ops: [
            "encrypt",
            "decrypt"
        ]
    },
    "RSA-OAEP": rsaes(1),
    "RSA-OAEP-256": rsaes(256),
    "RSA-OAEP-384": rsaes(384),
    "RSA-OAEP-512": rsaes(512),
    "ECDH-ES": ecdh("direct-key-agreement"),
    "ECDH-ES+A128KW": ecdh("key-agreement-with-key-wrapping"),
    "ECDH-ES+A192KW": ecdh("key-agreement-with-key-wrapping"),
    "ECDH-ES+A256KW": ecdh("key-agreement-with-key-wrapping"),
    A128KW: aeskw(128),
    A192KW: aeskw(192),
    A256KW: aeskw(256),
    A128GCMKW: aeskw(128, !0),
    A192GCMKW: aeskw(192, !0),
    A256GCMKW: aeskw(256, !0),
    "PBES2-HS256+A128KW": pbes2(),
    "PBES2-HS384+A192KW": pbes2(),
    "PBES2-HS512+A256KW": pbes2()
}), contentOps = [
    "encrypt",
    "decrypt"
];
function contentEncryption(bits, cbc = !1) {
    return {
        kty: [
            "oct"
        ],
        secret: !0,
        subtle: {
            name: cbc ? "AES-CBC" : "AES-GCM",
            length: bits
        },
        usages: none,
        ops: contentOps,
        cekBits: bits,
        ivBits: cbc ? 128 : 96,
        cbc
    };
}
const ENC = (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$key_descriptor$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["table"])({
    A128GCM: contentEncryption(128),
    A192GCM: contentEncryption(192),
    A256GCM: contentEncryption(256),
    "A128CBC-HS256": contentEncryption(256, !0),
    "A192CBC-HS384": contentEncryption(384, !0),
    "A256CBC-HS512": contentEncryption(512, !0)
});
function unsupported(parameter, name) {
    throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JOSENotSupported"](`Invalid or unsupported "${parameter}" (JWE ${name}) header value`);
}
function jweAlgorithm(alg) {
    return (typeof alg == "string" ? JWE[alg] : void 0) ?? unsupported("alg", "Algorithm");
}
function isJWECEKTransport(algorithm) {
    return algorithm.mode === "key-wrapping" || algorithm.mode === "key-encryption" || algorithm.mode === "key-agreement-with-key-wrapping";
}
function jweEncryption(enc) {
    return (typeof enc == "string" ? ENC[enc] : void 0) ?? unsupported("enc", "Encryption Algorithm");
}
;
}),
"[project]/central-auth/node_modules/jose/dist/webapi/lib/jwe_decrypt.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "checkRecipient",
    ()=>checkRecipient,
    "decryptCompact",
    ()=>decryptCompact,
    "decryptJWE",
    ()=>decryptJWE,
    "prepareDecrypt",
    ()=>prepareDecrypt,
    "shareJWE",
    ()=>shareJWE,
    "snapshotRecipientJWE",
    ()=>snapshotRecipientJWE,
    "snapshotSharedJWE",
    ()=>snapshotSharedJWE
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$content_encryption$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/jose/dist/webapi/lib/content_encryption.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$validate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/jose/dist/webapi/lib/validate.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/jose/dist/webapi/util/errors.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$key_management$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/jose/dist/webapi/lib/key_management.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$buffer_utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/jose/dist/webapi/lib/buffer_utils.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$key$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/jose/dist/webapi/lib/key.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$jwe_algorithms$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/jose/dist/webapi/lib/jwe_algorithms.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$deflate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/jose/dist/webapi/lib/deflate.js [app-route] (ecmascript)");
;
;
;
;
;
;
;
;
function snapshotSharedJWE(jwe) {
    const { aad, ciphertext, iv, protected: encodedProtected, tag, unprotected } = jwe;
    if (iv !== void 0 && (typeof iv != "string" || !iv)) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]("JWE Initialization Vector incorrect type");
    if (typeof ciphertext != "string") throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]("JWE Ciphertext missing or incorrect type");
    if (tag !== void 0 && (typeof tag != "string" || !tag)) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]("JWE Authentication Tag incorrect type");
    if (encodedProtected !== void 0 && typeof encodedProtected != "string") throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]("JWE Protected Header incorrect type");
    if (aad !== void 0 && (typeof aad != "string" || !aad)) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]("JWE AAD incorrect type");
    if (unprotected !== void 0 && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$validate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isObject"])(unprotected)) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]("JWE Shared Unprotected Header incorrect type");
    return {
        aad,
        ciphertext,
        iv,
        protected: encodedProtected,
        tag,
        unprotected: unprotected === void 0 ? void 0 : {
            ...unprotected
        }
    };
}
function snapshotRecipientJWE(recipient) {
    let header, headerAlg;
    try {
        const { header: inputHeader } = recipient;
        if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$validate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isObject"])(inputHeader)) {
            headerAlg = inputHeader.alg;
            const parameters = Object.keys(inputHeader);
            parameters.includes("alg") || (headerAlg = void 0), header = Object.fromEntries(parameters.map((parameter)=>[
                    parameter,
                    parameter === "alg" ? headerAlg : inputHeader[parameter]
                ]));
        } else header = inputHeader;
        const { encrypted_key: encryptedKey } = recipient;
        return [
            {
                encrypted_key: encryptedKey,
                header
            },
            headerAlg
        ];
    } catch (error) {
        return [
            void 0,
            headerAlg,
            error
        ];
    }
}
function checkRecipient(jwe) {
    const { encrypted_key: encryptedKey, header } = jwe;
    if (encryptedKey !== void 0 && typeof encryptedKey != "string") throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]("JWE Encrypted Key incorrect type");
    if (header !== void 0 && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$validate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isObject"])(header)) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]("JWE Per-Recipient Unprotected Header incorrect type");
    if (jwe.protected === void 0 && header === void 0 && jwe.unprotected === void 0) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]("JOSE Header missing");
}
function shareJWE(jwe) {
    const { protected: encodedProtected, ciphertext, iv, tag, aad } = jwe;
    let protectedHeader;
    return encodedProtected !== void 0 && (protectedHeader = (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$validate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["parseJoseHeader"])(encodedProtected, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"], "JWE Protected Header is invalid")), [
        protectedHeader,
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$validate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["decodeBase64url"])(ciphertext, "ciphertext", __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]),
        iv !== void 0 ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$validate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["decodeBase64url"])(iv, "iv", __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]) : void 0,
        tag !== void 0 ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$validate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["decodeBase64url"])(tag, "tag", __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]) : void 0,
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$validate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["encodeAsciiMember"])((encodedProtected ?? "") + (aad !== void 0 ? `.${aad}` : ""), "aad", __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"])
    ];
}
function prepareDecrypt(options) {
    const keyManagementAlgorithms = options && (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$validate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["validateAlgorithms"])("keyManagementAlgorithms", options.keyManagementAlgorithms), contentEncryptionAlgorithms = options && (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$validate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["validateAlgorithms"])("contentEncryptionAlgorithms", options.contentEncryptionAlgorithms), { crit, maxPBES2Count, maxDecompressedLength } = options ?? {};
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$key_management$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["validateMaxPBES2Count"])(maxPBES2Count);
    const decompressionLimit = maxDecompressedLength ?? 25e4;
    if (decompressionLimit !== 0 && decompressionLimit !== 1 / 0 && (!Number.isSafeInteger(decompressionLimit) || decompressionLimit < 1)) throw new TypeError("maxDecompressedLength must be 0, a positive safe integer, or Infinity");
    return [
        keyManagementAlgorithms,
        contentEncryptionAlgorithms,
        crit,
        maxPBES2Count,
        maxDecompressedLength
    ];
}
async function decryptJWE(jwe, shared, key, token = shareJWE(jwe)) {
    const [protectedHeader, ciphertext, iv, tag, additionalAuthenticatedData] = token, { header, unprotected, aad } = jwe;
    let joseHeader;
    if (header !== void 0 || unprotected !== void 0) {
        if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$validate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isDisjoint"])(protectedHeader, header, unprotected)) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]("JWE Protected, JWE Unprotected Header, and JWE Per-Recipient Unprotected Header Parameter names must be disjoint");
        joseHeader = {
            ...protectedHeader,
            ...header,
            ...unprotected
        };
    } else joseHeader = protectedHeader ?? {};
    const [keyManagementAlgorithms, contentEncryptionAlgorithms, crit, maxPBES2Count, maxDecompressedLength] = shared, { encrypted_key: encodedKey } = jwe;
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$validate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["validateCrit"])(__TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"], __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$validate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWE_RECOGNIZED"], crit, protectedHeader, joseHeader), (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$deflate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["validateZip"])(joseHeader, protectedHeader);
    const { alg, enc } = joseHeader;
    if (typeof alg != "string" || !alg) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]("missing JWE Algorithm (alg) in JWE Header");
    const selected = __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$jwe_algorithms$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWE"][alg];
    if (encodedKey === "" && (!selected || !(0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$jwe_algorithms$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isJWECEKTransport"])(selected))) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]("JWE Encrypted Key incorrect type");
    const integrated = selected?.mode === "integrated-encryption";
    if (!integrated && (typeof enc != "string" || !enc)) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]("missing JWE Encryption Algorithm (enc) in JWE Header");
    if (keyManagementAlgorithms && !keyManagementAlgorithms.has(alg) || !keyManagementAlgorithms && alg.startsWith("PBES2")) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JOSEAlgNotAllowed"]('"alg" (Algorithm) Header Parameter value not allowed');
    let encEntry;
    if (integrated) {
        if (enc !== void 0) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]('JWE "enc" (Encryption Algorithm) Header Parameter must not be present for integrated encryption');
        if (iv?.byteLength) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]("JWE Initialization Vector must be empty for integrated encryption");
        if (tag?.byteLength) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]("JWE Authentication Tag must be empty for integrated encryption");
    } else {
        if (contentEncryptionAlgorithms && !contentEncryptionAlgorithms.has(enc)) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JOSEAlgNotAllowed"]('"enc" (Encryption Algorithm) Header Parameter value not allowed');
        encEntry = (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$jwe_algorithms$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["jweEncryption"])(enc);
    }
    let encryptedKey;
    if (encodedKey !== void 0) try {
        encryptedKey = (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$validate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["decodeBase64url"])(encodedKey, "encrypted_key", __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]);
    } catch (error) {
        if (!selected || !(0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$jwe_algorithms$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isJWECEKTransport"])(selected)) throw error;
        encryptedKey = new Uint8Array();
    }
    let resolvedKey = !1;
    typeof key == "function" && (key = await key(protectedHeader, jwe), resolvedKey = !0);
    const algEntry = selected ?? (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$jwe_algorithms$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["jweAlgorithm"])(alg);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$jwe_algorithms$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isJWECEKTransport"])(algEntry) && encryptedKey === void 0 && (encryptedKey = new Uint8Array());
    const k = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$key$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prepareKey"])(algEntry.mode === "direct-encryption" ? encEntry : algEntry, key, "decrypt");
    let plaintext;
    if (algEntry.mode === "integrated-encryption") plaintext = await algEntry.decrypt(k, encryptedKey, ciphertext, additionalAuthenticatedData, protectedHeader, joseHeader);
    else {
        const encryption = encEntry;
        let cek;
        try {
            cek = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$key_management$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["decryptKeyManagement"])(algEntry, encryption, k, encryptedKey, joseHeader, maxPBES2Count), (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$jwe_algorithms$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isJWECEKTransport"])(algEntry) && cek instanceof Uint8Array && cek.byteLength << 3 !== encryption.cekBits && (cek = (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$content_encryption$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["generateCek"])(encryption));
        } catch (err) {
            if (err instanceof TypeError || err instanceof __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"] || err instanceof __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JOSENotSupported"]) throw err;
            cek = (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$content_encryption$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["generateCek"])(encryption);
        }
        plaintext = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$content_encryption$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["decrypt"])(encryption, cek, ciphertext, iv, tag, additionalAuthenticatedData);
    }
    if (joseHeader.zip === "DEF") {
        const decompressionLimit = maxDecompressedLength ?? 25e4;
        if (decompressionLimit === 0) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JOSENotSupported"]('JWE "zip" (Compression Algorithm) Header Parameter is not supported.');
        plaintext = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$deflate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["decompress"])(plaintext, decompressionLimit).catch((cause)=>{
            throw cause instanceof __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"] ? cause : new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]("Failed to decompress plaintext", {
                cause
            });
        });
    }
    return {
        plaintext,
        ...protectedHeader && {
            protectedHeader
        },
        ...aad !== void 0 && {
            additionalAuthenticatedData: (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$validate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["decodeBase64url"])(aad, "aad", __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"])
        },
        ...unprotected && {
            sharedUnprotectedHeader: unprotected
        },
        ...header && {
            unprotectedHeader: header
        },
        ...resolvedKey && {
            key: k
        }
    };
}
async function decryptCompact(jwe, shared, key) {
    if (jwe instanceof Uint8Array && (jwe = __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$buffer_utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["decoder"].decode(jwe)), typeof jwe != "string") throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]("Compact JWE must be a string or Uint8Array");
    const { 0: protectedHeader, 1: encryptedKey, 2: iv, 3: ciphertext, 4: tag, length } = jwe.split(".");
    if (length !== 5) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]("Invalid Compact JWE");
    return decryptJWE({
        ciphertext,
        iv: iv || void 0,
        protected: protectedHeader,
        tag: tag || void 0,
        encrypted_key: encryptedKey || void 0
    }, shared, key);
}
;
}),
"[project]/central-auth/node_modules/jose/dist/webapi/lib/jwt_claims_set.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "JWTClaimsBuilder",
    ()=>JWTClaimsBuilder,
    "jwtClaim",
    ()=>jwtClaim,
    "jwtClaimsSetBytes",
    ()=>jwtClaimsSetBytes,
    "secs",
    ()=>secs,
    "validateClaimsSet",
    ()=>validateClaimsSet
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/jose/dist/webapi/util/errors.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$buffer_utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/jose/dist/webapi/lib/buffer_utils.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$validate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/jose/dist/webapi/lib/validate.js [app-route] (ecmascript)");
;
;
;
const epoch = (date)=>Math.floor(date.getTime() / 1e3), multipliers = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
    w: 604800,
    y: 31557600
}, REGEX = /^(\+|\-)? ?(\d+|\d+\.\d+) ?(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)(?: (ago|from now))?$/i, checkFailed = "check_failed";
function invalidDuration() {
    throw new TypeError("Invalid time period format");
}
function secs(str) {
    typeof str != "string" && invalidDuration();
    const matched = REGEX.exec(str);
    (!matched || matched[4] && matched[1]) && invalidDuration();
    const value = parseFloat(matched[2]), durationSeconds = Math.round(value * multipliers[matched[3][0].toLowerCase()]);
    return Number.isFinite(durationSeconds) || invalidDuration(), matched[1] === "-" || matched[4] === "ago" ? -durationSeconds : durationSeconds;
}
function validateInput(label, input) {
    if (!Number.isFinite(input)) throw new TypeError(`Invalid ${label} input`);
    return input;
}
function validateStringClaim(claim, value) {
    if (typeof value != "string") throw new TypeError(`"${claim}" claim must be a string`);
}
function validateAudienceClaim(value) {
    if (typeof value != "string" && (!Array.isArray(value) || Array.from(value).some((member)=>typeof member != "string"))) throw new TypeError('"aud" claim must be a string or an array of strings');
}
function numericDate(value, label) {
    return typeof value == "number" ? validateInput(label, value) : value instanceof Date ? validateInput(label, epoch(value)) : epoch(/* @__PURE__ */ new Date()) + secs(value);
}
const normalizeTyp = (value)=>{
    const normalized = value.toLowerCase();
    return value.includes("/") ? normalized : `application/${normalized}`;
}, checkAudiencePresence = (audPayload, audOption)=>typeof audPayload == "string" ? audOption.includes(audPayload) : Array.isArray(audPayload) ? audOption.some((aud)=>audPayload.includes(aud)) : !1;
function validateNumericDate(claimsSet, claim, required = !1) {
    const value = claimsSet[claim];
    if (!(value === void 0 && !required)) {
        if (typeof value != "number") throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWTClaimValidationFailed"](`"${claim}" claim must be a number`, claimsSet, claim, "invalid");
        return value;
    }
}
function unexpectedClaim(claimsSet, claim) {
    throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWTClaimValidationFailed"](`unexpected "${claim}" claim value`, claimsSet, claim, checkFailed);
}
function validateClaimsSet(protectedHeader, claimsSetBytes, options = {}) {
    let claimsSet;
    try {
        claimsSet = JSON.parse(__TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$buffer_utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["strictDecoder"].decode(claimsSetBytes));
    } catch (cause) {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWTInvalid"]("JWT Claims Set must be a top-level JSON object", {
            cause
        });
    }
    if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$validate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isObject"])(claimsSet)) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWTInvalid"]("JWT Claims Set must be a top-level JSON object");
    const { typ } = options;
    if (typ !== void 0 && (typeof protectedHeader.typ != "string" || normalizeTyp(protectedHeader.typ) !== normalizeTyp(typ))) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWTClaimValidationFailed"]('unexpected "typ" JWT header value', claimsSet, "typ", checkFailed);
    const { requiredClaims = [], issuer, subject, audience, maxTokenAge } = options, presenceCheck = [
        ...requiredClaims
    ];
    maxTokenAge !== void 0 && presenceCheck.push("iat"), audience !== void 0 && presenceCheck.push("aud"), subject !== void 0 && presenceCheck.push("sub"), issuer !== void 0 && presenceCheck.push("iss");
    for (const claim of new Set(presenceCheck.reverse()))if (!Object.hasOwn(claimsSet, claim)) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWTClaimValidationFailed"](`missing required "${claim}" claim`, claimsSet, claim, "missing");
    issuer !== void 0 && !(Array.isArray(issuer) ? issuer : [
        issuer
    ]).includes(claimsSet.iss) && unexpectedClaim(claimsSet, "iss"), subject !== void 0 && claimsSet.sub !== subject && unexpectedClaim(claimsSet, "sub"), audience !== void 0 && !checkAudiencePresence(claimsSet.aud, typeof audience == "string" ? [
        audience
    ] : audience) && unexpectedClaim(claimsSet, "aud");
    const { clockTolerance } = options;
    let tolerance = 0;
    if (typeof clockTolerance == "string") tolerance = secs(clockTolerance);
    else if (clockTolerance !== void 0) {
        if (typeof clockTolerance != "number") throw new TypeError("Invalid clockTolerance option type");
        tolerance = clockTolerance;
    }
    if (validateInput("clockTolerance option", tolerance), tolerance < 0) throw new TypeError("Invalid clockTolerance option input");
    const { currentDate } = options, now = validateInput("currentDate option", epoch(currentDate === void 0 ? /* @__PURE__ */ new Date() : currentDate)), iat = validateNumericDate(claimsSet, "iat", maxTokenAge !== void 0), nbf = validateNumericDate(claimsSet, "nbf");
    if (nbf !== void 0 && nbf > now + tolerance) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWTClaimValidationFailed"]('"nbf" claim timestamp check failed', claimsSet, "nbf", checkFailed);
    const exp = validateNumericDate(claimsSet, "exp");
    if (exp !== void 0 && exp <= now - tolerance) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWTExpired"]('"exp" claim timestamp check failed', claimsSet, "exp", checkFailed);
    if (maxTokenAge !== void 0) {
        const age = now - iat, max = validateInput("maxTokenAge option", typeof maxTokenAge == "number" ? maxTokenAge : secs(maxTokenAge));
        if (max < 0) throw new TypeError("Invalid maxTokenAge option input");
        if (age - tolerance > max) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWTExpired"]('"iat" claim timestamp check failed (too far in the past)', claimsSet, "iat", checkFailed);
        if (age < -tolerance) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWTClaimValidationFailed"]('"iat" claim timestamp check failed (it should be in the past)', claimsSet, "iat", checkFailed);
    }
    return claimsSet;
}
let producerClaimsSets;
function producerClaimsSet(producer) {
    return producerClaimsSets.get(producer);
}
function jwtClaimsSetBytes(producer) {
    const claimsSet = producerClaimsSet(producer);
    for (const claim of [
        "iat",
        "nbf",
        "exp"
    ]){
        const value = claimsSet[claim];
        if (typeof value == "number" && !Number.isFinite(value)) throw new TypeError(`"${claim}" claim must be a finite number`);
    }
    return __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$buffer_utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["encoder"].encode(JSON.stringify(claimsSet));
}
function jwtClaim(producer, claim) {
    return producerClaimsSet(producer)[claim];
}
class JWTClaimsBuilder {
    constructor(claimsSet = {}){
        if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$validate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isObject"])(claimsSet)) throw new TypeError("JWT Claims Set MUST be an object");
        (producerClaimsSets ||= /* @__PURE__ */ new WeakMap()).set(this, structuredClone(claimsSet));
    }
    setIssuer(value) {
        return validateStringClaim("iss", value), producerClaimsSet(this).iss = value, this;
    }
    setSubject(value) {
        return validateStringClaim("sub", value), producerClaimsSet(this).sub = value, this;
    }
    setAudience(value) {
        return validateAudienceClaim(value), producerClaimsSet(this).aud = value, this;
    }
    setJti(value) {
        return validateStringClaim("jti", value), producerClaimsSet(this).jti = value, this;
    }
    setNotBefore(value) {
        return producerClaimsSet(this).nbf = numericDate(value, "setNotBefore"), this;
    }
    setExpirationTime(value) {
        return producerClaimsSet(this).exp = numericDate(value, "setExpirationTime"), this;
    }
    setIssuedAt(value) {
        const claimsSet = producerClaimsSet(this);
        return value === void 0 ? claimsSet.iat = epoch(/* @__PURE__ */ new Date()) : typeof value == "string" ? claimsSet.iat = validateInput("setIssuedAt", epoch(/* @__PURE__ */ new Date()) + secs(value)) : claimsSet.iat = numericDate(value, "setIssuedAt"), this;
    }
}
;
}),
"[project]/central-auth/node_modules/jose/dist/webapi/lib/key.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "assertCryptoKey",
    ()=>assertCryptoKey,
    "checkCryptoKey",
    ()=>checkCryptoKey,
    "checkModulusLength",
    ()=>checkModulusLength,
    "checkUsage",
    ()=>checkUsage,
    "invalidKeyInput",
    ()=>invalidKeyInput,
    "isCryptoKey",
    ()=>isCryptoKey,
    "isKeyLike",
    ()=>isKeyLike,
    "isKeyObject",
    ()=>isKeyObject,
    "jwkToKey",
    ()=>jwkToKey,
    "normalizeJwk",
    ()=>normalizeJwk,
    "prepareKey",
    ()=>prepareKey,
    "rawKey",
    ()=>rawKey,
    "snapshotJwk",
    ()=>snapshotJwk,
    "validateExtractableOption",
    ()=>validateExtractableOption
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$validate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/jose/dist/webapi/lib/validate.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$base64url$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/jose/dist/webapi/util/base64url.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/jose/dist/webapi/util/errors.js [app-route] (ecmascript)");
;
;
;
const tag = (key)=>key[Symbol.toStringTag], jwkMatchesOp = (entry, key, usage)=>{
    const { alg } = entry;
    if (key.use !== void 0) {
        const expected = usage === "sign" || usage === "verify" ? "sig" : "enc";
        if (key.use !== expected) throw new TypeError(`Invalid key for this operation, its "use" must be "${expected}" when present`);
    }
    if (key.alg !== void 0 && key.alg !== alg) throw new TypeError(`Invalid key for this operation, its "alg" must be "${alg}" when present`);
    if (Array.isArray(key.key_ops)) {
        const expectedKeyOp = usage === "encrypt" || usage === "decrypt" ? entry.ops?.[usage === "encrypt" ? 0 : 1] : usage;
        if (expectedKeyOp && !key.key_ops.includes(expectedKeyOp)) throw new TypeError(`Invalid key for this operation, its "key_ops" must include "${expectedKeyOp}" when present`);
    }
};
async function prepareKey(entry, key, usage) {
    const { alg, secret } = entry, requiresPrivateKey = usage === "decrypt" || usage === "sign";
    if (secret && key instanceof Uint8Array) return key;
    let normalized, keyObject;
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$validate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isObject"])(key)) {
        if (normalized = normalizeJwk(key), typeof normalized.kty != "string") throw invalidKeyType(alg, key, secret);
        if (!(secret ? normalized.kty === "oct" && typeof normalized.k == "string" : normalized.kty !== "oct" && (requiresPrivateKey ? normalized.kty === "AKP" && typeof normalized.priv == "string" || typeof normalized.d == "string" : normalized.d === void 0 && normalized.priv === void 0))) throw new TypeError(secret ? 'JSON Web Key for symmetric algorithms must have JWK "kty" (Key Type) equal to "oct" and the JWK "k" (Key Value) present' : `JSON Web Key for this operation must be a ${requiresPrivateKey ? "private" : "public"} JWK`);
        if (jwkMatchesOp(entry, normalized, usage), normalized.kty === "oct") return (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$base64url$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["decode"])(normalized.k);
        if (!Object.isFrozen(key)) {
            const { key_ops } = key;
            Array.isArray(key_ops) && Object.freeze(key_ops), Object.freeze(key);
        }
    } else {
        if (!isKeyLike(key)) throw invalidKeyType(alg, key, secret);
        const expectedType = secret ? "secret" : requiresPrivateKey ? "private" : "public";
        if (key.type !== expectedType && (secret || [
            "secret",
            "public",
            "private"
        ].includes(key.type))) throw new TypeError(`${tag(key)} instances must be of type "${expectedType}" for the ${alg} algorithm`);
        if (isCryptoKey(key)) return key;
        if (keyObject = key, keyObject.type === "secret") return keyObject.export();
    }
    cache ||= /* @__PURE__ */ new WeakMap();
    const cacheKey = key;
    let cached = cache.get(cacheKey);
    if (cached?.[alg]) return cached[alg];
    if (cached || cache.set(cacheKey, cached = {}), keyObject && typeof keyObject.toCryptoKey == "function") {
        const isPublic = keyObject.type === "public", crv = nist[keyObject.asymmetricKeyDetails?.namedCurve], params = entry.resolve?.({
            crv,
            asymmetricKeyType: keyObject.asymmetricKeyType
        }) ?? entry.subtle;
        return cached[alg] = keyObject.toCryptoKey(params, isPublic, entry.usages[isPublic ? 0 : 1]);
    }
    return normalized ??= keyObject.export({
        format: "jwk"
    }), normalized.alg = alg, cached[alg] = await jwkToKey(entry, normalized);
}
let cache;
const nist = {
    __proto__: null,
    prime256v1: "P-256",
    secp384r1: "P-384",
    secp521r1: "P-521"
};
function assertCryptoKey(key) {
    if (!isCryptoKey(key)) throw new Error("CryptoKey instance expected");
}
const isCryptoKey = (key)=>{
    if (key?.[Symbol.toStringTag] === "CryptoKey") return !0;
    try {
        return key instanceof CryptoKey;
    } catch  {
        return !1;
    }
}, isKeyObject = (key)=>key?.[Symbol.toStringTag] === "KeyObject", isKeyLike = (key)=>isCryptoKey(key) || isKeyObject(key);
function message(msg, actual, ...types) {
    if (types.length > 2) {
        const last = types.pop();
        msg += `one of type ${types.join(", ")}, or ${last}.`;
    } else types.length === 2 ? msg += `one of type ${types[0]} or ${types[1]}.` : msg += `of type ${types[0]}.`;
    return actual == null ? msg += ` Received ${actual}` : typeof actual == "function" && actual.name ? msg += ` Received function ${actual.name}` : typeof actual == "object" && actual != null && actual.constructor?.name && (msg += ` Received an instance of ${actual.constructor.name}`), msg;
}
const invalidKeyInput = (actual, ...types)=>message("Key must be ", actual, ...types);
function invalidKeyType(alg, actual, secret) {
    const types = [
        "CryptoKey",
        "KeyObject",
        "JSON Web Key"
    ];
    return secret && types.push("Uint8Array"), new TypeError(message(`Key for the ${alg} algorithm must be `, actual, ...types));
}
const unusable = (name, prop = "algorithm.name")=>new TypeError(`CryptoKey does not support this operation, its ${prop} must be ${name}`);
function checkUsage(key, usage) {
    if (usage && !key.usages.includes(usage)) throw new TypeError(`CryptoKey does not support this operation, its usages must include ${usage}.`);
}
function checkModulusLength(alg, key) {
    const { modulusLength } = key.algorithm;
    if (typeof modulusLength != "number" || modulusLength < 2048) throw new TypeError(`${alg} requires key modulusLength to be 2048 bits or larger`);
}
function checkCryptoKey(key, expected, usage) {
    const algorithm = key.algorithm;
    if (algorithm.name !== expected.name) throw unusable(expected.name);
    if (expected.hash && algorithm.hash?.name !== expected.hash) throw unusable(expected.hash, "algorithm.hash");
    if (expected.namedCurve && algorithm.namedCurve !== expected.namedCurve) throw unusable(expected.namedCurve, "algorithm.namedCurve");
    if (expected.length !== void 0 && algorithm.length !== expected.length) throw unusable(expected.length, "algorithm.length");
    checkUsage(key, usage);
}
function snapshotJwk(jwk) {
    return {
        __proto__: null,
        ...jwk
    };
}
function normalizeJwk(jwk) {
    const normalized = snapshotJwk(jwk);
    if (normalized.ext !== void 0 && typeof normalized.ext != "boolean") throw new TypeError('"ext" (Extractable) Parameter must be a boolean');
    if (normalized.key_ops !== void 0) {
        const value = normalized.key_ops, keyOps = Array.isArray(value) ? [
            ...value
        ] : void 0;
        if (!keyOps || keyOps.some((operation)=>typeof operation != "string") || new Set(keyOps).size !== keyOps.length) throw new TypeError('"key_ops" (Key Operations) Parameter must be an array of unique strings');
        normalized.key_ops = keyOps;
    }
    return normalized;
}
function validateExtractableOption(extractable) {
    if (extractable !== void 0 && typeof extractable != "boolean") throw new TypeError('"extractable" option must be a boolean');
    return extractable;
}
async function jwkToKey(entry, jwk, extractable) {
    if (!entry.kty.includes(jwk.kty)) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JOSENotSupported"]('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
    const algorithm = entry.resolve?.({
        kty: jwk.kty,
        crv: jwk.crv
    }) ?? entry.subtle, isPrivate = !!(jwk.d || jwk.priv), keyData = {
        ...jwk,
        ext: extractable ?? jwk.ext
    };
    return keyData.kty !== "AKP" && delete keyData.alg, delete keyData.use, crypto.subtle.importKey("jwk", keyData, algorithm, keyData.ext ?? !isPrivate, jwk.key_ops ?? entry.usages[isPrivate ? 1 : 0]);
}
async function rawKey(key, expected, usage, extractable = !1) {
    return key instanceof Uint8Array && (key = await crypto.subtle.importKey("raw", key, expected, extractable, [
        usage
    ])), checkCryptoKey(key, expected, usage), key;
}
;
}),
"[project]/central-auth/node_modules/jose/dist/webapi/lib/key_descriptor.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "table",
    ()=>table
]);
function table(entries) {
    const out = {
        __proto__: null
    };
    for(const alg in entries)out[alg] = {
        ...entries[alg],
        alg
    };
    return out;
}
;
}),
"[project]/central-auth/node_modules/jose/dist/webapi/lib/key_management.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "decryptKeyManagement",
    ()=>decryptKeyManagement,
    "encryptKeyManagement",
    ()=>encryptKeyManagement,
    "validateMaxPBES2Count",
    ()=>validateMaxPBES2Count
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$base64url$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/jose/dist/webapi/util/base64url.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$key$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/jose/dist/webapi/lib/key.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$jwe_algorithms$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/jose/dist/webapi/lib/jwe_algorithms.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/jose/dist/webapi/util/errors.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$validate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/jose/dist/webapi/lib/validate.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$buffer_utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/jose/dist/webapi/lib/buffer_utils.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$content_encryption$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/jose/dist/webapi/lib/content_encryption.js [app-route] (ecmascript)");
;
;
;
;
;
;
;
function checkEcdhCryptoKey(key, usage) {
    if (key.algorithm.name !== "ECDH" && key.algorithm.name !== "X25519") throw new TypeError("CryptoKey does not support this operation, its algorithm.name must be ECDH or X25519");
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$key$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["checkUsage"])(key, usage);
}
async function aeskwWrap(alg, key, cek) {
    const cryptoKey = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$key$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["rawKey"])(key, (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$jwe_algorithms$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["jweAlgorithm"])(alg).subtle, "wrapKey", !0), cryptoKeyCek = await crypto.subtle.importKey("raw", cek, {
        hash: "SHA-256",
        name: "HMAC"
    }, !0, [
        "sign"
    ]);
    return new Uint8Array(await crypto.subtle.wrapKey("raw", cryptoKeyCek, cryptoKey, "AES-KW"));
}
async function aeskwUnwrap(alg, key, encryptedKey) {
    const cryptoKey = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$key$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["rawKey"])(key, (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$jwe_algorithms$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["jweAlgorithm"])(alg).subtle, "unwrapKey", !0), cryptoKeyCek = await crypto.subtle.unwrapKey("raw", encryptedKey, cryptoKey, "AES-KW", {
        hash: "SHA-256",
        name: "HMAC"
    }, !0, [
        "sign"
    ]);
    return new Uint8Array(await crypto.subtle.exportKey("raw", cryptoKeyCek));
}
function checkRsaKey(alg, key, usage) {
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$key$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["checkCryptoKey"])(key, (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$jwe_algorithms$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["jweAlgorithm"])(alg).subtle, usage), (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$key$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["checkModulusLength"])(alg, key);
}
async function deriveKey(p2s, alg, p2c, key) {
    if (!(p2s instanceof Uint8Array) || p2s.length < 8) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]("PBES2 Salt Input must be 8 or more octets");
    if (!Number.isSafeInteger(p2c) || Math.sign(p2c) !== 1) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]("PBES2 Count Input must be a positive integer");
    const salt = (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$buffer_utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["concat"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$buffer_utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["encode"])(alg), Uint8Array.of(0), p2s), keyLengthBits = parseInt(alg.slice(13, 16), 10), subtleAlg = {
        hash: `SHA-${alg.slice(8, 11)}`,
        iterations: p2c,
        name: "PBKDF2",
        salt
    }, cryptoKey = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$key$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["rawKey"])(key, (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$jwe_algorithms$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["jweAlgorithm"])(alg).subtle, "deriveBits");
    return new Uint8Array(await crypto.subtle.deriveBits(subtleAlg, cryptoKey, keyLengthBits));
}
function lengthAndInput(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$buffer_utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["concat"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$buffer_utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["uint32be"])(input.length), input);
}
async function concatKdf(Z, keyDataLength, OtherInfo) {
    const dkLen = keyDataLength >> 3, hashLen = 32, reps = Math.ceil(dkLen / hashLen), dk = new Uint8Array(reps * hashLen);
    for(let i = 1; i <= reps; i++){
        const hashResult = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$buffer_utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["digest"])("sha256", (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$buffer_utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["concat"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$buffer_utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["uint32be"])(i), Z, OtherInfo));
        dk.set(hashResult, (i - 1) * hashLen);
    }
    return dk.slice(0, dkLen);
}
async function ecdhesDeriveKey(publicKey, privateKey, algorithmId, keyDataLength, apu = new Uint8Array(), apv = new Uint8Array()) {
    checkEcdhCryptoKey(publicKey), checkEcdhCryptoKey(privateKey, "deriveBits");
    const otherInfo = (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$buffer_utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["concat"])(lengthAndInput((0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$buffer_utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["encode"])(algorithmId)), lengthAndInput(apu), lengthAndInput(apv), (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$buffer_utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["uint32be"])(keyDataLength)), Z = new Uint8Array(await crypto.subtle.deriveBits({
        name: publicKey.algorithm.name,
        public: publicKey
    }, privateKey, publicKey.algorithm.name === "X25519" ? 256 : Math.ceil(parseInt(publicKey.algorithm.namedCurve.slice(-3), 10) / 8) << 3));
    return concatKdf(Z, keyDataLength, otherInfo);
}
function assertEcdhKey(key) {
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$key$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["assertCryptoKey"])(key);
    const curve = key.algorithm.namedCurve;
    if (curve !== "P-256" && curve !== "P-384" && curve !== "P-521" && key.algorithm.name !== "X25519") throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JOSENotSupported"]("ECDH with the provided key is not allowed or not supported by your javascript runtime");
}
function partyInfo(joseHeader, name) {
    const value = joseHeader[name];
    if (value !== void 0) {
        if (typeof value != "string") throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"](`JOSE Header "${name}" (Agreement Party${name === "apu" ? "U" : "V"}Info) invalid`);
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$validate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["decodeBase64url"])(value, name, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]);
    }
}
function checkPartyInfo(apu, apv) {
    if (!(apu === void 0 || apv === void 0 || apu.byteLength !== apv.byteLength)) {
        for(let i = 0; i < apu.byteLength; i++)if (apu[i] !== apv[i]) return;
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]('JOSE Header "apu" and "apv" values must be distinct');
    }
}
function assertEncryptedKey(encryptedKey) {
    if (encryptedKey === void 0) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]("JWE Encrypted Key missing");
}
function assertNoEncryptedKey(encryptedKey) {
    if (encryptedKey !== void 0) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]("Encountered unexpected JWE Encrypted Key");
}
function validateMaxPBES2Count(value) {
    if (value !== void 0 && value !== 1 / 0 && (!Number.isSafeInteger(value) || value < 1)) throw new TypeError("maxPBES2Count must be a positive safe integer or Infinity");
}
async function decryptKeyManagement(entry, enc, key, encryptedKey, joseHeader, maxPBES2Count) {
    const { alg } = entry, mode = entry.mode;
    if (mode === "direct-encryption") return assertNoEncryptedKey(encryptedKey), key;
    const direct = mode === "direct-key-agreement";
    switch(direct ? assertNoEncryptedKey(encryptedKey) : assertEncryptedKey(encryptedKey), entry.subtle.name){
        case "ECDH":
            {
                const { epk } = joseHeader;
                if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$validate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isObject"])(epk) || [
                    "d",
                    "k",
                    "p",
                    "q",
                    "dp",
                    "dq",
                    "qi",
                    "oth",
                    "priv"
                ].some((parameter)=>Object.hasOwn(epk, parameter))) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]('JOSE Header "epk" (Ephemeral Public Key) missing or invalid');
                assertEcdhKey(key);
                const ephemeralPublicKey = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$key$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["jwkToKey"])(entry, epk), partyUInfo = partyInfo(joseHeader, "apu"), partyVInfo = partyInfo(joseHeader, "apv");
                checkPartyInfo(partyUInfo, partyVInfo);
                const derivedKey = await ecdhesDeriveKey(ephemeralPublicKey, key, direct ? enc.alg : alg, direct ? enc.cekBits : parseInt(alg.slice(-5, -2), 10), partyUInfo, partyVInfo);
                if (direct) return derivedKey;
                key = derivedKey;
                break;
            }
        case "RSA-OAEP":
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$key$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["assertCryptoKey"])(key), checkRsaKey(alg, key, "decrypt"), new Uint8Array(await crypto.subtle.decrypt("RSA-OAEP", key, encryptedKey));
        case "PBKDF2":
            {
                if (typeof joseHeader.p2c != "number") throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]('JOSE Header "p2c" (PBES2 Count) missing or invalid');
                const p2cLimit = maxPBES2Count ?? 1e4;
                if (joseHeader.p2c > p2cLimit) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]('JOSE Header "p2c" (PBES2 Count) out is of acceptable bounds');
                if (typeof joseHeader.p2s != "string") throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]('JOSE Header "p2s" (PBES2 Salt) missing or invalid');
                const p2s = (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$validate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["decodeBase64url"])(joseHeader.p2s, "p2s", __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]);
                key = await deriveKey(p2s, alg, joseHeader.p2c, key);
                break;
            }
        case "AES-GCM":
            {
                if (typeof joseHeader.iv != "string") throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]('JOSE Header "iv" (Initialization Vector) missing or invalid');
                if (typeof joseHeader.tag != "string") throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]('JOSE Header "tag" (Authentication Tag) missing or invalid');
                const iv = (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$validate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["decodeBase64url"])(joseHeader.iv, "iv", __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]), tag = (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$validate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["decodeBase64url"])(joseHeader.tag, "tag", __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]);
                if (iv.byteLength !== 12) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]("Invalid Initialization Vector length");
                if (tag.byteLength !== 16) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWEInvalid"]("Invalid Authentication Tag length");
                return (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$content_encryption$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["decrypt"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$jwe_algorithms$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["jweEncryption"])(alg.slice(0, -2)), key, encryptedKey, iv, tag, new Uint8Array());
            }
    }
    return aeskwUnwrap(alg.slice(-6), key, encryptedKey);
}
async function encryptKeyManagement(entry, enc, inputKey, joseHeader, providedCek, providedParameters = {}) {
    const { alg, mode } = entry, transport = (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$jwe_algorithms$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isJWECEKTransport"])(entry);
    if (providedCek !== void 0 && !transport) throw new TypeError(`setContentEncryptionKey cannot be called with JWE "alg" (Algorithm) Header ${alg}`);
    let key = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$key$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prepareKey"])(mode === "direct-encryption" ? enc : entry, inputKey, "encrypt");
    if (mode === "direct-encryption") return [
        key,
        void 0,
        void 0
    ];
    const cek = transport ? providedCek ?? (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$content_encryption$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["generateCek"])(enc) : void 0;
    cek && (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$content_encryption$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["checkCekLength"])(cek, enc.cekBits);
    let encryptedKey, parameters;
    switch(entry.subtle.name){
        case "ECDH":
            {
                assertEcdhKey(key);
                const { apu: providedApu, apv: providedApv } = providedParameters;
                providedApu !== void 0 && (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$validate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["assertUint8Array"])(providedApu, '"apu"'), providedApv !== void 0 && (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$validate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["assertUint8Array"])(providedApv, '"apv"');
                const apu = providedApu ?? partyInfo(joseHeader, "apu"), apv = providedApv ?? partyInfo(joseHeader, "apv");
                checkPartyInfo(apu, apv);
                let ephemeralPrivateKey;
                providedParameters.epk !== void 0 ? ephemeralPrivateKey = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$key$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prepareKey"])(entry, providedParameters.epk, "decrypt") : ephemeralPrivateKey = (await crypto.subtle.generateKey(key.algorithm, !0, [
                    "deriveBits"
                ])).privateKey;
                const subtle = crypto.subtle;
                let exportableEpk = ephemeralPrivateKey;
                if (!exportableEpk.extractable) {
                    if (typeof subtle.getPublicKey != "function") throw new TypeError('CryptoKey for "epk" must be extractable');
                    exportableEpk = await subtle.getPublicKey(ephemeralPrivateKey, []);
                }
                const { x, y, crv, kty } = await subtle.exportKey("jwk", exportableEpk), direct = mode === "direct-key-agreement", derivedKey = await ecdhesDeriveKey(key, ephemeralPrivateKey, direct ? enc.alg : alg, direct ? enc.cekBits : parseInt(alg.slice(-5, -2), 10), apu, apv), epk = {
                    x,
                    crv,
                    kty
                };
                if (kty === "EC" && (epk.y = y), parameters = {
                    epk
                }, providedApu !== void 0 && (parameters.apu = (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$base64url$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["encode"])(providedApu)), providedApv !== void 0 && (parameters.apv = (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$base64url$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["encode"])(providedApv)), direct) return [
                    derivedKey,
                    void 0,
                    parameters
                ];
                key = derivedKey;
                break;
            }
        case "RSA-OAEP":
            {
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$key$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["assertCryptoKey"])(key), checkRsaKey(alg, key, "encrypt"), encryptedKey = new Uint8Array(await crypto.subtle.encrypt("RSA-OAEP", key, cek));
                break;
            }
        case "PBKDF2":
            {
                const { p2c = 2048, p2s = crypto.getRandomValues(new Uint8Array(16)) } = providedParameters;
                key = await deriveKey(p2s, alg, p2c, key), parameters = {
                    p2c,
                    p2s: (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$base64url$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["encode"])(p2s)
                };
                break;
            }
        case "AES-GCM":
            {
                const iv = providedParameters.iv === void 0 ? crypto.getRandomValues(new Uint8Array(12)) : providedParameters.iv;
                if (!(iv instanceof Uint8Array)) throw new TypeError('"iv" must be an instance of Uint8Array');
                const wrapped = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$content_encryption$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["encrypt"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$jwe_algorithms$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["jweEncryption"])(alg.slice(0, -2)), cek, key, iv, new Uint8Array());
                encryptedKey = wrapped.ciphertext, parameters = {
                    iv: (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$base64url$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["encode"])(wrapped.iv),
                    tag: (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$base64url$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["encode"])(wrapped.tag)
                };
            }
    }
    if (encryptedKey ??= await aeskwWrap(alg.slice(-6), key, cek), !(encryptedKey instanceof Uint8Array) || !encryptedKey.byteLength) throw new TypeError("JWE key management algorithm did not produce an Encrypted Key");
    return [
        cek,
        encryptedKey,
        parameters
    ];
}
;
}),
"[project]/central-auth/node_modules/jose/dist/webapi/lib/validate.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "JWE_RECOGNIZED",
    ()=>JWE_RECOGNIZED,
    "JWS_RECOGNIZED",
    ()=>JWS_RECOGNIZED,
    "assertNotSet",
    ()=>assertNotSet,
    "assertUint8Array",
    ()=>assertUint8Array,
    "decodeBase64url",
    ()=>decodeBase64url,
    "encodeAsciiMember",
    ()=>encodeAsciiMember,
    "isDisjoint",
    ()=>isDisjoint,
    "isJwkSet",
    ()=>isJwkSet,
    "isObject",
    ()=>isObject,
    "parseJoseHeader",
    ()=>parseJoseHeader,
    "serializeJoseHeader",
    ()=>serializeJoseHeader,
    "validateAlgorithms",
    ()=>validateAlgorithms,
    "validateB64",
    ()=>validateB64,
    "validateCrit",
    ()=>validateCrit,
    "validateCritDuplicates",
    ()=>validateCritDuplicates
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/jose/dist/webapi/util/errors.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$base64url$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/jose/dist/webapi/util/base64url.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$buffer_utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/jose/dist/webapi/lib/buffer_utils.js [app-route] (ecmascript)");
;
;
;
function assertUint8Array(input, label) {
    if (!(input instanceof Uint8Array)) throw new TypeError(`${label} must be an instance of Uint8Array`);
}
function isObject(input) {
    if (typeof input != "object" || input === null || Object.prototype.toString.call(input) !== "[object Object]") return !1;
    const prototype = Object.getPrototypeOf(input);
    return prototype === null || Object.getPrototypeOf(prototype) === null;
}
function isJwkSet(input) {
    return isObject(input) && Array.isArray(input.keys) && Array.from(input.keys).every(isObject);
}
function isDisjoint(...headers) {
    const parameters = /* @__PURE__ */ new Set();
    for (const header of headers)if (header) for (const parameter of Object.keys(header)){
        if (parameters.has(parameter)) return !1;
        parameters.add(parameter);
    }
    return !0;
}
function assertNotSet(value, name) {
    if (value !== void 0) throw new TypeError(`${name} can only be called once`);
}
function decodeBase64url(value, label, ErrorClass) {
    try {
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$base64url$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["decode"])(value);
    } catch (cause) {
        throw new ErrorClass(`Failed to base64url decode the ${label}`, {
            cause
        });
    }
}
function encodeAsciiMember(value, label, ErrorClass) {
    try {
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$buffer_utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["encode"])(value);
    } catch (cause) {
        throw new ErrorClass(`The ${label} is not a valid base64url string`, {
            cause
        });
    }
}
function parseJoseHeader(encodedProtectedHeader, ErrorClass, message) {
    let parsed;
    try {
        parsed = JSON.parse(__TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$buffer_utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["strictDecoder"].decode((0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$base64url$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["decode"])(encodedProtectedHeader)));
    } catch (cause) {
        throw new ErrorClass(message, {
            cause
        });
    }
    if (!isObject(parsed)) throw new ErrorClass(message);
    return parsed;
}
const JWS_RECOGNIZED = {
    __proto__: null,
    b64: !0
}, JWE_RECOGNIZED = {
    __proto__: null
};
function validateAlgorithms(option, algorithms) {
    if (algorithms !== void 0 && (!Array.isArray(algorithms) || algorithms.some((s)=>typeof s != "string"))) throw new TypeError(`"${option}" option must be an array of strings`);
    return algorithms === void 0 ? void 0 : new Set(algorithms);
}
function validateCritDuplicates(Err, protectedHeader) {
    const { crit } = protectedHeader ?? {};
    if (Array.isArray(crit) && new Set(crit).size !== crit.length) throw new Err('"crit" (Critical) Header Parameter MUST NOT contain duplicate values');
}
function validateCrit(Err, recognizedDefault, recognizedOption, protectedHeader, joseHeader) {
    if (joseHeader.crit !== void 0 && protectedHeader?.crit === void 0) throw new Err('"crit" (Critical) Header Parameter MUST be integrity protected');
    if (!protectedHeader || protectedHeader.crit === void 0) return [];
    if (!Array.isArray(protectedHeader.crit) || protectedHeader.crit.length === 0 || protectedHeader.crit.some((input)=>typeof input != "string" || input.length === 0)) throw new Err('"crit" (Critical) Header Parameter MUST be an array of non-empty strings when present');
    const recognized = recognizedOption === void 0 ? recognizedDefault : {
        __proto__: null,
        ...recognizedOption,
        ...recognizedDefault
    };
    for (const parameter of protectedHeader.crit){
        if (!(parameter in recognized)) throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JOSENotSupported"](`Extension Header Parameter "${parameter}" is not recognized`);
        if (!Object.hasOwn(joseHeader, parameter) || joseHeader[parameter] === void 0) throw new Err(`Extension Header Parameter "${parameter}" is missing`);
        if (recognized[parameter] && (!Object.hasOwn(protectedHeader, parameter) || protectedHeader[parameter] === void 0)) throw new Err(`Extension Header Parameter "${parameter}" MUST be integrity protected`);
    }
    return protectedHeader.crit;
}
function validateB64(protectedHeader, extensions) {
    if (extensions.includes("b64")) {
        const b64 = protectedHeader.b64;
        if (typeof b64 != "boolean") throw new __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$util$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["JWSInvalid"]('The "b64" (base64url-encode payload) Header Parameter must be a boolean');
        return b64;
    }
    return !0;
}
function serializeJoseHeader(Err, header) {
    let serialized, parsed;
    try {
        serialized = JSON.stringify(header), parsed = JSON.parse(serialized);
    } catch (cause) {
        throw new Err("JOSE Header is not valid JSON", {
            cause
        });
    }
    if (!isObject(parsed)) throw new Err("JOSE Header is not a JSON object");
    return [
        parsed,
        serialized
    ];
}
;
}),
"[project]/central-auth/node_modules/jose/dist/webapi/util/base64url.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "decode",
    ()=>decode,
    "encode",
    ()=>encode
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$buffer_utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/jose/dist/webapi/lib/buffer_utils.js [app-route] (ecmascript)");
;
const invalid = "The input to be decoded is not correctly encoded.";
function decode(input) {
    try {
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$buffer_utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["decodeBase64"])(typeof input == "string" ? input : __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$buffer_utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["decoder"].decode(input), !0);
    } catch (cause) {
        throw new TypeError(invalid, {
            cause
        });
    }
}
function encode(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$buffer_utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["encodeBase64"])(typeof input == "string" ? __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$lib$2f$buffer_utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["encoder"].encode(input) : input, !0);
}
;
}),
"[project]/central-auth/node_modules/jose/dist/webapi/util/errors.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "JOSEAlgNotAllowed",
    ()=>JOSEAlgNotAllowed,
    "JOSEError",
    ()=>JOSEError,
    "JOSENotSupported",
    ()=>JOSENotSupported,
    "JWEDecryptionFailed",
    ()=>JWEDecryptionFailed,
    "JWEInvalid",
    ()=>JWEInvalid,
    "JWKInvalid",
    ()=>JWKInvalid,
    "JWKSInvalid",
    ()=>JWKSInvalid,
    "JWKSMultipleMatchingKeys",
    ()=>JWKSMultipleMatchingKeys,
    "JWKSNoMatchingKey",
    ()=>JWKSNoMatchingKey,
    "JWKSTimeout",
    ()=>JWKSTimeout,
    "JWSInvalid",
    ()=>JWSInvalid,
    "JWSSignatureVerificationFailed",
    ()=>JWSSignatureVerificationFailed,
    "JWTClaimValidationFailed",
    ()=>JWTClaimValidationFailed,
    "JWTExpired",
    ()=>JWTExpired,
    "JWTInvalid",
    ()=>JWTInvalid
]);
class JOSEError extends Error {
    static code = "ERR_JOSE_GENERIC";
    code = "ERR_JOSE_GENERIC";
    constructor(message, options){
        super(message, options), this.name = this.constructor.name, Error.captureStackTrace?.(this, this.constructor);
    }
}
class JWTClaimValidationFailed extends JOSEError {
    static code = "ERR_JWT_CLAIM_VALIDATION_FAILED";
    code = "ERR_JWT_CLAIM_VALIDATION_FAILED";
    claim;
    reason;
    payload;
    constructor(message, payload, claim = "unspecified", reason = "unspecified"){
        super(message, {
            cause: {
                claim,
                reason,
                payload
            }
        }), this.claim = claim, this.reason = reason, this.payload = payload;
    }
}
class JWTExpired extends JOSEError {
    static code = "ERR_JWT_EXPIRED";
    code = "ERR_JWT_EXPIRED";
    claim;
    reason;
    payload;
    constructor(message, payload, claim = "unspecified", reason = "unspecified"){
        super(message, {
            cause: {
                claim,
                reason,
                payload
            }
        }), this.claim = claim, this.reason = reason, this.payload = payload;
    }
}
class JOSEAlgNotAllowed extends JOSEError {
    static code = "ERR_JOSE_ALG_NOT_ALLOWED";
    code = "ERR_JOSE_ALG_NOT_ALLOWED";
}
class JOSENotSupported extends JOSEError {
    static code = "ERR_JOSE_NOT_SUPPORTED";
    code = "ERR_JOSE_NOT_SUPPORTED";
}
class JWEDecryptionFailed extends JOSEError {
    static code = "ERR_JWE_DECRYPTION_FAILED";
    code = "ERR_JWE_DECRYPTION_FAILED";
    constructor(message = "decryption operation failed", options){
        super(message, options);
    }
}
class JWEInvalid extends JOSEError {
    static code = "ERR_JWE_INVALID";
    code = "ERR_JWE_INVALID";
}
class JWSInvalid extends JOSEError {
    static code = "ERR_JWS_INVALID";
    code = "ERR_JWS_INVALID";
}
class JWTInvalid extends JOSEError {
    static code = "ERR_JWT_INVALID";
    code = "ERR_JWT_INVALID";
}
class JWKInvalid extends JOSEError {
    static code = "ERR_JWK_INVALID";
    code = "ERR_JWK_INVALID";
}
class JWKSInvalid extends JOSEError {
    static code = "ERR_JWKS_INVALID";
    code = "ERR_JWKS_INVALID";
}
class JWKSNoMatchingKey extends JOSEError {
    static code = "ERR_JWKS_NO_MATCHING_KEY";
    code = "ERR_JWKS_NO_MATCHING_KEY";
    constructor(message = "no applicable key found in the JSON Web Key Set", options){
        super(message, options);
    }
}
class JWKSMultipleMatchingKeys extends JOSEError {
    [Symbol.asyncIterator] = async function*() {};
    static code = "ERR_JWKS_MULTIPLE_MATCHING_KEYS";
    code = "ERR_JWKS_MULTIPLE_MATCHING_KEYS";
    constructor(message = "multiple matching keys found in the JSON Web Key Set", options){
        super(message, options);
    }
}
class JWKSTimeout extends JOSEError {
    static code = "ERR_JWKS_TIMEOUT";
    code = "ERR_JWKS_TIMEOUT";
    constructor(message = "request timed out", options){
        super(message, options);
    }
}
class JWSSignatureVerificationFailed extends JOSEError {
    static code = "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
    code = "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
    constructor(message = "signature verification failed", options){
        super(message, options);
    }
}
;
}),
"[project]/central-auth/node_modules/math-intrinsics/abs.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('./abs')} */ module.exports = Math.abs;
}),
"[project]/central-auth/node_modules/math-intrinsics/floor.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('./floor')} */ module.exports = Math.floor;
}),
"[project]/central-auth/node_modules/math-intrinsics/isNaN.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('./isNaN')} */ module.exports = Number.isNaN || function isNaN(a) {
    return a !== a;
};
}),
"[project]/central-auth/node_modules/math-intrinsics/max.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('./max')} */ module.exports = Math.max;
}),
"[project]/central-auth/node_modules/math-intrinsics/min.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('./min')} */ module.exports = Math.min;
}),
"[project]/central-auth/node_modules/math-intrinsics/pow.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('./pow')} */ module.exports = Math.pow;
}),
"[project]/central-auth/node_modules/math-intrinsics/round.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('./round')} */ module.exports = Math.round;
}),
"[project]/central-auth/node_modules/math-intrinsics/sign.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var $isNaN = __turbopack_context__.r("[project]/central-auth/node_modules/math-intrinsics/isNaN.js [app-route] (ecmascript)");
/** @type {import('./sign')} */ module.exports = function sign(number) {
    if ($isNaN(number) || number === 0) {
        return number;
    }
    return number < 0 ? -1 : +1;
};
}),
"[project]/central-auth/node_modules/mime-types/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/*!
 * mime-types
 * Copyright(c) 2014 Jonathan Ong
 * Copyright(c) 2015 Douglas Christopher Wilson
 * MIT Licensed
 */ /**
 * Module dependencies.
 * @private
 */ var db = __turbopack_context__.r("[project]/central-auth/node_modules/mime-db/index.js [app-route] (ecmascript)");
var extname = __turbopack_context__.r("[externals]/path [external] (path, cjs)").extname;
/**
 * Module variables.
 * @private
 */ var EXTRACT_TYPE_REGEXP = /^\s*([^;\s]*)(?:;|\s|$)/;
var TEXT_TYPE_REGEXP = /^text\//i;
/**
 * Module exports.
 * @public
 */ exports.charset = charset;
exports.charsets = {
    lookup: charset
};
exports.contentType = contentType;
exports.extension = extension;
exports.extensions = Object.create(null);
exports.lookup = lookup;
exports.types = Object.create(null);
// Populate the extensions/types maps
populateMaps(exports.extensions, exports.types);
/**
 * Get the default charset for a MIME type.
 *
 * @param {string} type
 * @return {boolean|string}
 */ function charset(type) {
    if (!type || typeof type !== 'string') {
        return false;
    }
    // TODO: use media-typer
    var match = EXTRACT_TYPE_REGEXP.exec(type);
    var mime = match && db[match[1].toLowerCase()];
    if (mime && mime.charset) {
        return mime.charset;
    }
    // default text/* to utf-8
    if (match && TEXT_TYPE_REGEXP.test(match[1])) {
        return 'UTF-8';
    }
    return false;
}
/**
 * Create a full Content-Type header given a MIME type or extension.
 *
 * @param {string} str
 * @return {boolean|string}
 */ function contentType(str) {
    // TODO: should this even be in this module?
    if (!str || typeof str !== 'string') {
        return false;
    }
    var mime = str.indexOf('/') === -1 ? exports.lookup(str) : str;
    if (!mime) {
        return false;
    }
    // TODO: use content-type or other module
    if (mime.indexOf('charset') === -1) {
        var charset = exports.charset(mime);
        if (charset) mime += '; charset=' + charset.toLowerCase();
    }
    return mime;
}
/**
 * Get the default extension for a MIME type.
 *
 * @param {string} type
 * @return {boolean|string}
 */ function extension(type) {
    if (!type || typeof type !== 'string') {
        return false;
    }
    // TODO: use media-typer
    var match = EXTRACT_TYPE_REGEXP.exec(type);
    // get extensions
    var exts = match && exports.extensions[match[1].toLowerCase()];
    if (!exts || !exts.length) {
        return false;
    }
    return exts[0];
}
/**
 * Lookup the MIME type for a file path/extension.
 *
 * @param {string} path
 * @return {boolean|string}
 */ function lookup(path) {
    if (!path || typeof path !== 'string') {
        return false;
    }
    // get the extension ("ext" or ".ext" or full path)
    var extension = extname('x.' + path).toLowerCase().substr(1);
    if (!extension) {
        return false;
    }
    return exports.types[extension] || false;
}
/**
 * Populate the extensions and types maps.
 * @private
 */ function populateMaps(extensions, types) {
    // source preference (least -> most)
    var preference = [
        'nginx',
        'apache',
        undefined,
        'iana'
    ];
    Object.keys(db).forEach(function forEachMimeType(type) {
        var mime = db[type];
        var exts = mime.extensions;
        if (!exts || !exts.length) {
            return;
        }
        // mime -> extensions
        extensions[type] = exts;
        // extension -> mime
        for(var i = 0; i < exts.length; i++){
            var extension = exts[i];
            if (types[extension]) {
                var from = preference.indexOf(db[types[extension]].source);
                var to = preference.indexOf(mime.source);
                if (types[extension] !== 'application/octet-stream' && (from > to || from === to && types[extension].substr(0, 12) === 'application/')) {
                    continue;
                }
            }
            // set the extension -> mime
            types[extension] = type;
        }
    });
}
}),
"[project]/central-auth/node_modules/ms/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

/**
 * Helpers.
 */ var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var w = d * 7;
var y = d * 365.25;
/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} [options]
 * @throws {Error} throw an error if val is not a non-empty string or a number
 * @return {String|Number}
 * @api public
 */ module.exports = function(val, options) {
    options = options || {};
    var type = typeof val;
    if (type === 'string' && val.length > 0) {
        return parse(val);
    } else if (type === 'number' && isFinite(val)) {
        return options.long ? fmtLong(val) : fmtShort(val);
    }
    throw new Error('val is not a non-empty string or a valid number. val=' + JSON.stringify(val));
};
/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */ function parse(str) {
    str = String(str);
    if (str.length > 100) {
        return;
    }
    var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(str);
    if (!match) {
        return;
    }
    var n = parseFloat(match[1]);
    var type = (match[2] || 'ms').toLowerCase();
    switch(type){
        case 'years':
        case 'year':
        case 'yrs':
        case 'yr':
        case 'y':
            return n * y;
        case 'weeks':
        case 'week':
        case 'w':
            return n * w;
        case 'days':
        case 'day':
        case 'd':
            return n * d;
        case 'hours':
        case 'hour':
        case 'hrs':
        case 'hr':
        case 'h':
            return n * h;
        case 'minutes':
        case 'minute':
        case 'mins':
        case 'min':
        case 'm':
            return n * m;
        case 'seconds':
        case 'second':
        case 'secs':
        case 'sec':
        case 's':
            return n * s;
        case 'milliseconds':
        case 'millisecond':
        case 'msecs':
        case 'msec':
        case 'ms':
            return n;
        default:
            return undefined;
    }
}
/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */ function fmtShort(ms) {
    var msAbs = Math.abs(ms);
    if (msAbs >= d) {
        return Math.round(ms / d) + 'd';
    }
    if (msAbs >= h) {
        return Math.round(ms / h) + 'h';
    }
    if (msAbs >= m) {
        return Math.round(ms / m) + 'm';
    }
    if (msAbs >= s) {
        return Math.round(ms / s) + 's';
    }
    return ms + 'ms';
}
/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */ function fmtLong(ms) {
    var msAbs = Math.abs(ms);
    if (msAbs >= d) {
        return plural(ms, msAbs, d, 'day');
    }
    if (msAbs >= h) {
        return plural(ms, msAbs, h, 'hour');
    }
    if (msAbs >= m) {
        return plural(ms, msAbs, m, 'minute');
    }
    if (msAbs >= s) {
        return plural(ms, msAbs, s, 'second');
    }
    return ms + ' ms';
}
/**
 * Pluralization helper.
 */ function plural(ms, msAbs, n, name) {
    var isPlural = msAbs >= n * 1.5;
    return Math.round(ms / n) + ' ' + name + (isPlural ? 's' : '');
}
}),
"[project]/central-auth/node_modules/object-code/dist/index.mjs [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "hash",
    ()=>e
]);
function t(t, r) {
    return t > r ? 1 : -1;
}
function r(r, n) {
    return t(String(r[0]), String(n[0]));
}
function n(t, r) {
    return 33 * t ^ r;
}
function e(o, i) {
    var f = 5381;
    if ("object" == typeof o && null !== o) {
        var u = "function" == typeof o.entries, a = Object.keys(o).length > 0;
        if (o.toString === Object.prototype.toString || o.toString === Array.prototype.toString || u && !a) {
            i || (i = new WeakSet), i.add(o);
            var c = u && !a ? Array.from(o.entries()) : Object.keys(o).sort(t).map(function(t) {
                return [
                    t,
                    o[t]
                ];
            });
            u && !a && c.sort(r);
            for(var g = 0; g < c.length; g++){
                var y = c[g], p = y[1];
                if (f = n(f, e(y[0], i)), "object" == typeof p && null !== p && (p.toString === Object.prototype.toString || p.toString === Array.prototype.toString)) {
                    if (i.has(p)) continue;
                    i.add(p);
                }
                f = n(f, e(p, i));
            }
            return n(f, e(o.constructor, i));
        }
    }
    for(var S, b = typeof o, l = 0; l < b.length; l++)f = n(f, b.charCodeAt(l));
    if (o instanceof Date) return n(f, o.getTime());
    if ("number" === b) return n(f, function(t) {
        if (Number.isNaN(t)) return 2146959360;
        if (Infinity === t) return 2146435072;
        if (-Infinity === t) return 4293918720;
        if (Math.abs(t) > Number.MAX_SAFE_INTEGER) {
            for(var r = String(t), e = 0, o = 0; o < r.length; o++)e = n(e, r.charCodeAt(o));
            return e;
        }
        return t;
    }(o));
    if ("boolean" === b) return n(f, o ? 1 : 0);
    try {
        S = String(o);
    } catch (t) {
        S = Object.prototype.toString.call(o);
    }
    for(var h = 0; h < S.length; h++)f = n(f, S.charCodeAt(h));
    return f;
}
;
}),
"[project]/central-auth/node_modules/proxy-from-env/index.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getProxyForUrl",
    ()=>getProxyForUrl
]);
'use strict';
var DEFAULT_PORTS = {
    ftp: 21,
    gopher: 70,
    http: 80,
    https: 443,
    ws: 80,
    wss: 443
};
function parseUrl(urlString) {
    try {
        return new URL(urlString);
    } catch  {
        return null;
    }
}
function getProxyForUrl(url) {
    var parsedUrl = (typeof url === 'string' ? parseUrl(url) : url) || {};
    var proto = parsedUrl.protocol;
    var hostname = parsedUrl.host;
    var port = parsedUrl.port;
    if (typeof hostname !== 'string' || !hostname || typeof proto !== 'string') {
        return ''; // Don't proxy URLs without a valid scheme or host.
    }
    proto = proto.split(':', 1)[0];
    // Stripping ports in this way instead of using parsedUrl.hostname to make
    // sure that the brackets around IPv6 addresses are kept.
    hostname = hostname.replace(/:\d*$/, '');
    port = parseInt(port) || DEFAULT_PORTS[proto] || 0;
    if (!shouldProxy(hostname, port)) {
        return ''; // Don't proxy URLs that match NO_PROXY.
    }
    var proxy = getEnv(proto + '_proxy') || getEnv('all_proxy');
    if (proxy && proxy.indexOf('://') === -1) {
        // Missing scheme in proxy, default to the requested URL's scheme.
        proxy = proto + '://' + proxy;
    }
    return proxy;
}
/**
 * Determines whether a given URL should be proxied.
 *
 * @param {string} hostname - The host name of the URL.
 * @param {number} port - The effective port of the URL.
 * @returns {boolean} Whether the given URL should be proxied.
 * @private
 */ function shouldProxy(hostname, port) {
    var NO_PROXY = getEnv('no_proxy').toLowerCase();
    if (!NO_PROXY) {
        return true; // Always proxy if NO_PROXY is not set.
    }
    if (NO_PROXY === '*') {
        return false; // Never proxy if wildcard is set.
    }
    return NO_PROXY.split(/[,\s]/).every(function(proxy) {
        if (!proxy) {
            return true; // Skip zero-length hosts.
        }
        var parsedProxy = proxy.match(/^(.+):(\d+)$/);
        var parsedProxyHostname = parsedProxy ? parsedProxy[1] : proxy;
        var parsedProxyPort = parsedProxy ? parseInt(parsedProxy[2]) : 0;
        if (parsedProxyPort && parsedProxyPort !== port) {
            return true; // Skip if ports don't match.
        }
        if (!/^[.*]/.test(parsedProxyHostname)) {
            // No wildcards, so stop proxying if there is an exact match.
            return hostname !== parsedProxyHostname;
        }
        if (parsedProxyHostname.charAt(0) === '*') {
            // Remove leading wildcard.
            parsedProxyHostname = parsedProxyHostname.slice(1);
        }
        // Stop proxying if the hostname ends with the no_proxy host.
        return !hostname.endsWith(parsedProxyHostname);
    });
}
/**
 * Get the value for an environment variable.
 *
 * @param {string} key - The name of the environment variable.
 * @return {string} The value of the environment variable.
 * @private
 */ function getEnv(key) {
    return process.env[key.toLowerCase()] || process.env[key.toUpperCase()] || '';
}
}),
"[project]/central-auth/node_modules/supports-color/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

const os = __turbopack_context__.r("[externals]/os [external] (os, cjs)");
const tty = __turbopack_context__.r("[externals]/tty [external] (tty, cjs)");
const hasFlag = __turbopack_context__.r("[project]/central-auth/node_modules/has-flag/index.js [app-route] (ecmascript)");
const { env } = process;
let forceColor;
if (hasFlag('no-color') || hasFlag('no-colors') || hasFlag('color=false') || hasFlag('color=never')) {
    forceColor = 0;
} else if (hasFlag('color') || hasFlag('colors') || hasFlag('color=true') || hasFlag('color=always')) {
    forceColor = 1;
}
if ('FORCE_COLOR' in env) {
    if (env.FORCE_COLOR === 'true') {
        forceColor = 1;
    } else if (env.FORCE_COLOR === 'false') {
        forceColor = 0;
    } else {
        forceColor = env.FORCE_COLOR.length === 0 ? 1 : Math.min(parseInt(env.FORCE_COLOR, 10), 3);
    }
}
function translateLevel(level) {
    if (level === 0) {
        return false;
    }
    return {
        level,
        hasBasic: true,
        has256: level >= 2,
        has16m: level >= 3
    };
}
function supportsColor(haveStream, streamIsTTY) {
    if (forceColor === 0) {
        return 0;
    }
    if (hasFlag('color=16m') || hasFlag('color=full') || hasFlag('color=truecolor')) {
        return 3;
    }
    if (hasFlag('color=256')) {
        return 2;
    }
    if (haveStream && !streamIsTTY && forceColor === undefined) {
        return 0;
    }
    const min = forceColor || 0;
    if (env.TERM === 'dumb') {
        return min;
    }
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    if ('CI' in env) {
        if ([
            'TRAVIS',
            'CIRCLECI',
            'APPVEYOR',
            'GITLAB_CI',
            'GITHUB_ACTIONS',
            'BUILDKITE'
        ].some((sign)=>sign in env) || env.CI_NAME === 'codeship') {
            return 1;
        }
        return min;
    }
    if ('TEAMCITY_VERSION' in env) {
        return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
    }
    if (env.COLORTERM === 'truecolor') {
        return 3;
    }
    if ('TERM_PROGRAM' in env) {
        const version = parseInt((env.TERM_PROGRAM_VERSION || '').split('.')[0], 10);
        switch(env.TERM_PROGRAM){
            case 'iTerm.app':
                return version >= 3 ? 3 : 2;
            case 'Apple_Terminal':
                return 2;
        }
    }
    if (/-256(color)?$/i.test(env.TERM)) {
        return 2;
    }
    if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
        return 1;
    }
    if ('COLORTERM' in env) {
        return 1;
    }
    return min;
}
function getSupportLevel(stream) {
    const level = supportsColor(stream, stream && stream.isTTY);
    return translateLevel(level);
}
module.exports = {
    supportsColor: getSupportLevel,
    stdout: translateLevel(supportsColor(true, tty.isatty(1))),
    stderr: translateLevel(supportsColor(true, tty.isatty(2)))
};
}),
"[project]/central-auth/node_modules/try/lib/index.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/// <reference path="./index.d.ts" />
/** @template V */ __turbopack_context__.s([
    "Result",
    ()=>Result,
    "error",
    ()=>error,
    "ok",
    ()=>ok,
    "t",
    ()=>t
]);
class Result {
    /**
   * @param {boolean} ok
   * @param {unknown} [error]
   * @param {V} [value]
   */ constructor(ok, error, value){
        this.ok = !!ok;
        // must not set the other field to allow for
        // 'error' in result checks
        if (this.ok) {
            this.value = value;
        } else {
            this.error = error;
        }
    }
    *[Symbol.iterator]() {
        yield this.ok;
        yield this.error;
        yield this.value;
    }
    /**
   * @this void
   * @template T
   * @param {T} value
   */ static ok(value) {
        return new Result(true, undefined, value);
    }
    /**
   * @this void
   * @param {unknown} error
   */ static error(error) {
        return new Result(false, error);
    }
    /**
   * @this void
   * @template T
   * @param {any} result
   * @param {...any} args
   * @returns {Promise<Result<T>> | Result<T>}
   */ static try(result, ...args) {
        // Wraps everything because `try` should never throw.
        try {
            // If syncFn() is passed directly, it throws before try() runs.
            // To prevent this, wrap it in a function and unwrap its result.
            if (typeof result === 'function') {
                result = result.apply(undefined, args);
            }
            // Promises must return a valid Promise<Result<T>>
            if (result instanceof Promise) {
                return result.then(Result.ok, Result.error);
            }
            // If the result is not a function or a Promise, we can be sure its a success
            return Result.ok(result);
        } catch (error) {
            return Result.error(error);
        }
    }
}
const error = Result.error;
const ok = Result.ok;
const t = Result.try;
}),
];

//# sourceMappingURL=1kn-_142wifhmyw715._.js.map