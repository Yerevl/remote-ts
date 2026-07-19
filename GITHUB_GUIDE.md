# GitHub Integration Guide

This guide details the standard Git commands for maintaining and updating this project on GitHub.

---

## Daily Workflow: Staging and Pushing Changes

Whenever you make updates to the code (e.g., in `server.js`, `index.html`, or the Android project files):

### 1. Check your modified files
See which files have been modified or added:
```bash
git status
```

### 2. Stage your changes
Add the modified files to the commit staging area:
*   To add **all** changed files (excluding ignored files in `.gitignore`):
    ```bash
    git add .
    ```
*   To add a **specific** file:
    ```bash
    git add server.js
    ```

### 3. Commit your changes
Create a local snapshot of your staged changes with a descriptive message:
```bash
git commit -m "Update sleep logic and layout positions"
```

### 4. Push to GitHub
Upload your local commits to the remote GitHub repository:
```bash
git push
```

---

## Collaborating / Pulling Changes

If you make commits from another device and want to sync those updates down to this PC:
```bash
git pull
```

---

## Undoing Mistakes (Quick Reference)

*   **Discard local changes to a file** (reverts it to the last committed state):
    ```bash
    git checkout -- server.js
    ```
*   **Undo your last commit** (keeps your code modifications in place but un-commits them):
    ```bash
    git reset --soft HEAD~1
    ```
