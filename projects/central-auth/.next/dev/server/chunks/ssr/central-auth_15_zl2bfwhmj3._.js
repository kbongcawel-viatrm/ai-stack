module.exports = [
"[project]/central-auth/app/page.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Home
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$centralauth$2f$src$2f$client$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/centralauth/src/client.js [app-ssr] (ecmascript)");
"use client";
;
;
function Home() {
    const { user } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$centralauth$2f$src$2f$client$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useUser"])();
    const authError = ("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "min-h-screen flex flex-col justify-center items-center gap-8 p-8 font-[family-name:var(--font-geist-sans)]",
        children: [
            authError && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-red-600",
                role: "alert",
                children: [
                    "Authentication failed: ",
                    authError
                ]
            }, void 0, true, {
                fileName: "[project]/central-auth/app/page.tsx",
                lineNumber: 14,
                columnNumber: 9
            }, this),
            !!user && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: `You are logged in as ${user.email}.`
                    }, void 0, false, {
                        fileName: "[project]/central-auth/app/page.tsx",
                        lineNumber: 18,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                        className: "rounded-full border border-solid border-gray-600 px-8 py-2",
                        href: "/api/auth/logout",
                        children: "Log out"
                    }, void 0, false, {
                        fileName: "[project]/central-auth/app/page.tsx",
                        lineNumber: 19,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/central-auth/app/page.tsx",
                lineNumber: 17,
                columnNumber: 9
            }, this),
            user === null && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                className: "rounded-full border border-solid border-gray-600 px-8 py-2",
                href: "/api/auth/login",
                children: "Log in"
            }, void 0, false, {
                fileName: "[project]/central-auth/app/page.tsx",
                lineNumber: 28,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/central-auth/app/page.tsx",
        lineNumber: 12,
        columnNumber: 5
    }, this);
}
}),
"[project]/central-auth/node_modules/centralauth/src/client.js [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AffirmationRequired",
    ()=>AffirmationRequired,
    "useUser",
    ()=>useUser,
    "useUserRequired",
    ()=>useUserRequired,
    "withCentralAuthAutomaticLogin",
    ()=>withCentralAuthAutomaticLogin
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/central-auth/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
"use client";
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
const AffirmationRequired = ({ user, affirmationNeededAfter, config, children })=>{
    const affirmationNeeded = (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>{
        if (user.affirmationDate) {
            const affirmationDate = new Date(user.affirmationDate);
            const now = new Date();
            //Check if the affirmation date is older than the affirmationNeededAfter value
            if (now.getTime() - affirmationDate.getTime() >= affirmationNeededAfter * 1000) return true;
            else return false;
        } else return false;
    }, [
        user,
        affirmationNeededAfter
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (affirmationNeeded) {
            //Redirect to the affirmation page
            window.location.replace((config === null || config === void 0 ? void 0 : config.affirmationPath) || "/api/auth/affirm");
        }
    }, [
        affirmationNeeded
    ]);
    return affirmationNeeded ? null : children;
};
const useUser = (config)=>{
    const [user, setUser] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(undefined);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [isLoading, setIsLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(true);
    const [isValidating, setIsValidating] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(true);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const controller = new AbortController();
        const profilePath = (config === null || config === void 0 ? void 0 : config.profilePath) || "/api/auth/user";
        setIsLoading(true);
        setIsValidating(true);
        setError(null);
        fetch(profilePath, {
            signal: controller.signal
        }).then((response)=>__awaiter(void 0, void 0, void 0, function*() {
                if (!response.ok) throw new Error(`Failed to fetch user profile: ${response.status}`);
                return response.json();
            })).then((userData)=>{
            setUser(userData);
        }).catch((fetchError)=>{
            if (fetchError.name !== "AbortError") {
                setError(fetchError);
                setUser(null);
            }
        }).finally(()=>{
            if (!controller.signal.aborted) {
                setIsLoading(false);
                setIsValidating(false);
            }
        });
        return ()=>controller.abort();
    }, [
        config === null || config === void 0 ? void 0 : config.profilePath
    ]);
    return {
        user: !error ? user : null,
        error,
        isLoading,
        isValidating
    };
};
const useUserRequired = (config)=>{
    const { user, isLoading } = useUser(config);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!user && !isLoading) {
            //User is not logged in, redirect to the login page
            window.location.replace((config === null || config === void 0 ? void 0 : config.loginPath) || "/api/auth/login");
        }
    }, [
        user,
        isLoading
    ]);
    return user || null;
};
const withCentralAuthAutomaticLogin = (Component, config)=>{
    return function WithCentralAuthAutomaticLogin(props) {
        const PlaceholderComponent = (config === null || config === void 0 ? void 0 : config.PlaceholderComponent) || null;
        const [user, setUser] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])();
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
            fetch((config === null || config === void 0 ? void 0 : config.profilePath) || "/api/auth/user").then((response)=>{
                response.json().then((userData)=>{
                    if (userData == null) window.location.replace((config === null || config === void 0 ? void 0 : config.loginPath) || "/api/auth/login");
                    else setUser(userData);
                });
            });
        }, [
            config
        ]);
        if (user) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$central$2d$auth$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createElement"])(Component, Object.assign({}, props));
        return PlaceholderComponent;
    };
};
}),
"[project]/central-auth/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

module.exports = __turbopack_context__.r("[project]/central-auth/node_modules/next/dist/server/route-modules/app-page/module.compiled.js [app-ssr] (ecmascript)").vendored['react-ssr'].ReactJsxDevRuntime;
}),
];

//# sourceMappingURL=central-auth_15_zl2bfwhmj3._.js.map