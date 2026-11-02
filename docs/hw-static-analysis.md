# HW: Static Code Analysis (Draftly)

**Student:** Zheng Yao Wong
**Project:** Draftly, our CSE 3311 resume builder (React + TypeScript, with Supabase for login and saving)
**Code checked:** everything in `src/` at commit `0cca86e` (about 5,800 lines)
**Tool:** ESLint 9 with the TypeScript and React plugins

## (A) Getting the tool to run

### Why I chose ESLint

Our project is written in TypeScript. Closure Compiler and Flow don't understand TypeScript, so they wouldn't work on our code. ESLint does, as long as you add the `typescript-eslint` plugin. That plugin can also look at the types in our code, so it can find real problems and not just style issues. I also added the React and React Hooks plugins because most of our code is React.

### Steps

I used Windows 11 with Git Bash. I already had Node.js v24.16.0 and npm 11.4.2 installed.

**1. Make a folder for the tool.**
I didn't want to change our team's `package.json`, so I installed ESLint in a separate folder:

```bash
mkdir eslint-analysis
cd eslint-analysis
npm init -y
```

**2. Install ESLint and the plugins.**
I followed the setup guides at https://eslint.org/docs/latest/use/getting-started and https://typescript-eslint.io/getting-started. My first try installed the newest ESLint (version 10) and npm gave me this error:

```
npm error Could not resolve dependency:
npm error Conflicting peer dependency: eslint@9.39.5
npm error   peer eslint@"^3 || ... || ^9.7" from eslint-plugin-react@7.37.5
```

The React plugin doesn't work with ESLint 10 yet, so I switched to ESLint 9. I also picked TypeScript 5 since that's what our project uses:

```bash
npm install --save-dev eslint@9 @eslint/js@9 typescript-eslint eslint-plugin-react eslint-plugin-react-hooks globals typescript@5
```

These are the versions that got installed:

| Package | Version |
| --- | --- |
| eslint | 9.39.5 |
| @eslint/js | 9.39.5 |
| typescript-eslint | 8.72.1 |
| eslint-plugin-react | 7.37.5 |
| eslint-plugin-react-hooks | 7.1.1 |
| globals | 17.13.0 |
| typescript | 5.9.3 |

To check it worked, I ran `npx eslint --version` and it printed `v9.39.5`.

**3. Write the config file.**
I made a file called `eslint.config.mjs` in the `eslint-analysis` folder. It turns on the recommended rules for ESLint, TypeScript, React and React Hooks. It also points to our project's `tsconfig.app.json` so ESLint knows about our types. I told it to skip `dist/`, `node_modules/` and `legacy-demo/` (an old prototype we don't use anymore).

```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

const PROJECT = "C:/Users/wongz/OneDrive/Desktop/CSE3311-resumeBuilder";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "**/legacy-demo/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        project: [PROJECT + "/tsconfig.app.json"],
        tsconfigRootDir: PROJECT,
      },
    },
    plugins: { react, "react-hooks": reactHooks },
    settings: { react: { version: "18.3" } },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules, // new JSX transform
      ...reactHooks.configs.recommended.rules,
    },
  },
);
```

**4. Run it on the project.**
ESLint 9 only checks files inside the folder you run it from. So I ran it from our project folder and used `--prefix` to tell `npx` where I installed ESLint:

```bash
cd C:/Users/wongz/OneDrive/Desktop/CSE3311-resumeBuilder
npx --prefix <path-to>/eslint-analysis eslint \
    -c <path-to>/eslint-analysis/eslint.config.mjs src > eslint-report.txt
```

**5. Results.**
ESLint found **61 problems in 13 files**. It calls all of them "errors", but none of them stop the app from building or running.

| Rule | Count | Category |
| --- | ---: | --- |
| `@typescript-eslint/require-await` | 16 | Async style |
| `@typescript-eslint/no-misused-promises` | 13 | Async bugs |
| `@typescript-eslint/no-unnecessary-type-assertion` | 12 | Extra code |
| `react-hooks/set-state-in-effect` | 5 | React Hooks |
| `@typescript-eslint/no-floating-promises` | 5 | Async bugs |
| `@typescript-eslint/no-unsafe-argument` | 4 | Type safety |
| `@typescript-eslint/no-unsafe-assignment` | 3 | Type safety |
| `@typescript-eslint/no-unused-vars` | 1 | Unused code |
| `@typescript-eslint/no-unsafe-return` | 1 | Type safety |
| `@typescript-eslint/no-unsafe-member-access` | 1 | Type safety |

## (B) Four warnings

I picked four warnings from three different categories:

| # | Rule | Where | Good warning? |
| --- | --- | --- | --- |
| 1 | `no-misused-promises` | `src/components/TopBar.tsx:103` | Yes, it's a small real bug |
| 2 | `no-floating-promises` | `src/features/auth/AuthProvider.tsx:40` | Partly, it can't really happen but it's an easy fix |
| 3 | `require-await` | `src/store/memoryStore.ts:35` | No, false positive |
| 4 | `no-unsafe-member-access` | `src/lib/supabase.ts:29` | Technically right, but nothing can go wrong |

### Warning 1: `@typescript-eslint/no-misused-promises` (async bugs)

```
src/components/TopBar.tsx
  103:23  error  Promise-returning function provided to attribute where a void return was expected
```

**The code.** M is the `TopBar` component. L is line 103, where `handleSignOut` (an async function) is set as the Sign out button's `onClick`:

```tsx
38  async function handleSignOut() {
39    if (!auth) return
40    setSigningOut(true)
41    try {
44      await flush()
45      await auth.signOut()
46    } finally {
47      setSigningOut(false)
48    }
49  }
...
86  {auth?.user ? (
...
101   <button
102     type="button"
103     onClick={handleSignOut}
```

**What the warning is saying.** React doesn't do anything with what `onClick` returns. So if `handleSignOut` fails, nobody catches the error. It just shows up in the browser console and the user never finds out. The `try/finally` doesn't catch it either. `finally` only resets the button.

**B.1: Can the code reach line L?** Yes. Line 103 runs every time `TopBar` shows up while someone is logged in (line 86 checks `auth?.user`). For example, if Supabase is set up and the user has signed in, `TopBar` renders and line 103 runs.

**B.2: Can the warning's problem happen at L?** Yes. `handleSignOut` fails if `flush()` or `auth.signOut()` fails.

- `flush()` never fails. The `write()` function it uses catches its own errors and tries again later (`supabaseStore.ts:236-256`).
- `auth.signOut()` (`AuthProvider.tsx:75-78`) throws an error any time Supabase sends one back.

I looked at the Supabase library code (`GoTrueClient._signOut`). It sends back an error for any failed sign-out except HTTP 401, 403 and 404. That includes having no internet. So if the user is offline and clicks Sign out, `auth.signOut()` throws `Error("Failed to fetch")`, and the console shows `Uncaught (in promise) Error: Failed to fetch`.

**B.3: Can L be reached in normal use?** Yes. The button is always on screen when someone is logged in, and clicking it is how you sign out.

**B.4: Can the problem happen in normal use?** Yes. Losing Wi-Fi or Supabase going down is normal for a web app. If the user clicks Sign out then, the same thing from B.2 happens. Supabase still logs the user out on their device, but the error is lost and the user isn't told anything.

**Verdict: good warning.** It's a real bug, just not a serious one. We could fix it by catching the error inside `handleSignOut` and showing a message.

### Warning 2: `@typescript-eslint/no-floating-promises` (async bugs)

```
src/features/auth/AuthProvider.tsx
  40:5  error  Promises must be awaited, end with a call to .catch, end with a call
               to .then with a rejection handler or be explicitly marked as ignored
               with the `void` operator
```

**The code.** M is the `AuthProvider` component (the effect inside it that runs on startup). L is line 40:

```tsx
37  useEffect(() => {
38    const supabase = getSupabase()
39    let cancelled = false
40    supabase.auth.getSession().then(({ data }) => {
41      if (cancelled) return
42      setSession(data.session)
43      setLoading(false)
44    })
45    // Covers sign-in, sign-out, token refresh, and sign-outs in other tabs.
46    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
47      setSession(next)
48      setLoading(false)
49    })
...
54  }, [])
```

**What the warning is saying.** `getSession()` returns a Promise, and we only handle the success case with `.then`. There's no `.catch`, so if the Promise fails, the error goes unhandled and `setLoading(false)` never runs.

**B.1: Can the code reach line L?** Yes. Line 40 runs once when `AuthProvider` first loads, as long as `getSupabase()` on line 38 doesn't throw. For example, with the Supabase settings filled in, `main.tsx` renders `<AuthProvider>` when the app starts, and line 40 runs.

**B.2: Can the warning's problem happen at L?** Yes, but I had to set it up on purpose. `getSession()` reads the saved login from the browser's `localStorage`. I looked at the Supabase code (`GoTrueClient.__loadSession`) and it calls `localStorage.getItem` without a `try/catch`. So if `getItem` throws, `getSession()` fails. For example, in a test:

```ts
// after the Supabase client has been created
Storage.prototype.getItem = () => { throw new DOMException('blocked', 'SecurityError') }
// now render <AuthProvider> and line 40 runs
```

`getSession()` rejects, nothing catches it, and the console shows an unhandled promise rejection. I tested this in Node with the real Supabase library and a storage object whose `getItem` throws, and `getSession()` did reject. Also, `onAuthStateChange` reads storage the same way, so it fails too. That means `setLoading(false)` never runs and the app would be stuck on the loading screen.

**B.3: Can L be reached in normal use?** Yes. Every time the app starts with Supabase set up, `AuthProvider` loads and line 40 runs to check if the user is already logged in.

**B.4: Can the problem happen in normal use?** No, not realistically. I checked the Supabase code for the normal cases:

- If `localStorage` doesn't work in the browser, Supabase finds that out when it starts and stores the session in memory instead.
- If refreshing the login fails (for example, no internet), `getSession()` doesn't fail. It returns `{ data: { session: null }, error }`, so our `.then` still runs and sets `loading` to `false`.
- The code inside our `.then` only calls `setSession` and `setLoading`, which don't throw.

So in normal use the Promise always succeeds, and the missing `.catch` never matters. The only way to make it fail is something weird like storage breaking after the page already loaded.

**Verdict: partly good.** The problem can't really happen right now, but adding a `.catch` that sets `loading` to `false` would be an easy fix. Then the app couldn't get stuck on the loading screen if something unexpected did go wrong.

### Warning 3: `@typescript-eslint/require-await` (async style)

```
src/store/memoryStore.ts
  35:3  error  Async method 'list' has no 'await' expression
```

**The code.** M is `InMemoryResumeStore.list`. L is line 35:

```ts
28 export class InMemoryResumeStore implements ResumeStore {
...
35   async list(): Promise<Resume[]> {
36     return this.resumes.map(cloneResume)
37   }
```

The class has to follow this interface (`src/store/types.ts:22`):

```ts
export interface ResumeStore {
  list(): Promise<Resume[]>
  ...
}
```

**What the warning is saying.** The function is marked `async` but never uses `await`, so ESLint thinks the `async` is a mistake.

**B.1: Can the code reach line L?** Yes. Calling `new InMemoryResumeStore().list()` runs lines 35 and 36 and gives back a copy of the sample resumes.

**B.2: Can the warning's problem happen at L?** The function really has no `await`, so in that sense it "happens" every time. But it doesn't cause any problem, because the `async` is there on purpose:

- The `ResumeStore` interface says `list()` has to return a Promise, because the real Supabase version has to wait for the internet. If I take out `async`, TypeScript gives an error: `TS2739: Type 'Resume[]' is missing the following properties from type 'Promise<Resume[]>': then, catch`.
- Because of `async`, if something goes wrong inside the function, the caller's `.catch()` still handles it, the same way it would with the Supabase version.

**B.3: Can L be reached in normal use?** Yes. When the app runs in demo mode (without Supabase set up), it uses `InMemoryResumeStore`. `useResume` calls `list()` every time you open the builder or tracker page. Our unit tests call it too.

**B.4: Can the problem happen in normal use?** Same answer as B.2. There's no `await`, but that's on purpose and nothing goes wrong. All 15 `require-await` warnings in this file are the same situation.

**Verdict: false positive.** The `async` is needed so the in-memory store matches the interface. It would make more sense to turn this rule off for this file than to change the code.

### Warning 4: `@typescript-eslint/no-unsafe-member-access` (type safety)

```
src/lib/supabase.ts
  29:20  error  Unsafe member access .role on an `any` value
```

**The code.** M is `assertPublicKey(candidate: string)`. L is line 29. This function stops the app from starting if someone accidentally uses Supabase's secret key instead of the public one:

```ts
19 export function assertPublicKey(candidate: string): void {
20   if (candidate.startsWith('sb_secret_')) { throw ... }
25   const parts = candidate.split('.')
26   if (parts.length === 3) {
27     try {
28       const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
29       if (payload?.role === 'service_role') {
30         throw new Error('VITE_SUPABASE_ANON_KEY is the service_role key. ...')
31       }
34     } catch (e) {
35       if (e instanceof Error && e.message.startsWith('VITE_SUPABASE_ANON_KEY')) throw e
...
37     }
```

**What the warning is saying.** `JSON.parse` returns type `any`, which means TypeScript doesn't check it. If `payload` isn't an object, reading `payload.role` might crash or give a wrong answer.

**B.1: Can the code reach line L?** Yes. Line 29 runs when the key has three parts split by dots and the middle part decodes into valid JSON. For example:

```ts
// middle part = base64('{"role":"service_role"}')
assertPublicKey('x.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.y')
```

This gets to line 29 with `payload = { role: 'service_role' }`, then throws the error on line 30, which is what it's supposed to do. A key without three parts (like `'sb_publishable_abc123'`) stops at line 26, and a key with a broken middle part fails on line 28 and goes to the `catch`.

**B.2: Can the warning's problem happen at L?** I can make `payload` something that isn't an object, so the "unsafe" access does happen. But it never crashes or gives a wrong answer. `JSON.parse` can only return an object, array, string, number, true/false, or `null`, so I tested each kind in Node:

| Input (`x.<base64>.y`) | `payload` | `payload?.role` | Result |
| --- | --- | --- | --- |
| `{"role":"service_role"}` | object | `"service_role"` | throws the error (correct) |
| `{"iss":"supabase","role":"anon"}` | object | `"anon"` | works normally |
| `null` | null | `undefined` | works normally |
| `42` | number | `undefined` | works normally |
| `"str"` | string | `undefined` | works normally |
| `[]` | array | `undefined` | works normally |

The `?.` handles `null`, and everything else just gives `undefined`, which doesn't equal `'service_role'`. Line 29 is also inside a `try`, so even if something weird happened, it would get caught.

**B.3: Can L be reached in normal use?** Yes. `getSupabase()` calls `assertPublicKey(key)` (`supabase.ts:49`) with our Supabase key when the app starts. Older Supabase keys have three parts, so line 29 runs with something like `{ iss: 'supabase', role: 'anon', ... }`. Newer keys (`sb_publishable_...`) have no dots, so line 29 doesn't run for those.

**B.4: Can the problem happen in normal use?** No. In normal use, `payload` always comes from a real Supabase key, so it's always an object and `.role` is always a string. Even a typo in the key only leads to one of the safe cases from B.2.

**Verdict: technically right, but nothing can go wrong.** The code does read from an `any` value, but `?.`, `===` and the `try/catch` keep it safe. We could still give `payload` a real type to get rid of the warning:

```ts
const payload: unknown = JSON.parse(...)
if (
  typeof payload === 'object' && payload !== null &&
  'role' in payload && payload.role === 'service_role'
) { ... }
```
