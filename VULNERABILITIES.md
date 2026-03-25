# Vulnerability Assessment Report - RepoGraph

## 1. Executive Summary
RepoGraph is a client-side tool for visualizing GitHub repositories. After a thorough manual code review and automated testing, several potential vulnerabilities and security concerns were identified. Most are related to the client-side nature of the application and its reliance on external APIs.

## 2. Identified Vulnerabilities

### 2.1. Potential XSS in Markdown Rendering (Low Risk)
**Description**: The application uses `react-markdown` to render `.md` files and AI responses. If a malicious repository contains a Markdown file with embedded HTML that is not properly sanitized, it could lead to Cross-Site Scripting (XSS).
**Impact**: An attacker could craft a repository that, when viewed by a user, executes malicious JavaScript in the context of the RepoGraph application.
**Mitigation**: Ensure `react-markdown` is configured to disable HTML rendering (which is the default in v10) or use a library like `DOMPurify` to sanitize any HTML output.

### 2.2. Insecure Handling of Personal Access Tokens (Medium Risk)
**Description**: The application allows users to provide a GitHub Personal Access Token (PAT) for authenticated requests. This token is stored in the React state (`App.tsx`). While it is not persisted in `localStorage`, it remains in memory and could be extracted if the browser is compromised or if there is an XSS vulnerability.
**Impact**: Exposure of the user's GitHub PAT, which could grant an attacker access to the user's private repositories and other GitHub data.
**Mitigation**: Advise users to use fine-grained PATs with minimal permissions. Consider using a more secure way to handle tokens if a backend were available.

### 2.3. Regular Expression Denial of Service (ReDoS) (Low Risk)
**Description**: The dependency parser (`src/utils/parser.ts`) uses several regular expressions to identify imports and dependencies in various languages (JS, Python, Go, Rust). Some of these regex patterns could potentially be exploited with specially crafted input to cause a ReDoS attack, leading to high CPU usage and browser unresponsiveness.
**Impact**: The application could become unresponsive when analyzing a malicious repository.
**Mitigation**: Review and optimize regular expressions to avoid catastrophic backtracking. Use a safer parsing approach (e.g., AST-based parsing) for complex languages.

### 2.4. GitHub API Rate Limiting (Usability/DoS Risk)
**Description**: The application relies heavily on the GitHub API. Without a PAT, the API is limited to 60 requests per hour per IP address. A malicious actor could potentially "deny service" to a user by exhausting their rate limit.
**Impact**: The application becomes unusable for the user until the rate limit resets.
**Mitigation**: Implement better error handling and guidance for users when rate limits are hit. Encourage the use of PATs for large repositories.

### 2.5. Information Disclosure via Error Messages (Low Risk)
**Description**: The application displays error messages directly from the GitHub API or internal processing. In some cases, these messages might contain sensitive information or internal paths.
**Impact**: Potential disclosure of internal application structure or API details.
**Mitigation**: Sanitize error messages before displaying them to the user.

## 3. Conclusion
RepoGraph is relatively secure due to its client-side architecture and minimal backend interaction. However, the reliance on user-provided PATs and the parsing of untrusted repository content introduce some risks that should be addressed through better sanitization and user guidance.
