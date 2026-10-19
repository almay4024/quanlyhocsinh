#!/usr/bin/env bash
cd "$(dirname "$0")"
echo "========================================================"
echo "  TU DONG PUSH GITHUB & DEPLOY FIREBASE (LOP HOC VUI v3.0)"
echo "========================================================"
echo ""
echo "[1/2] Dang day code moi len GitHub..."
git add -A
git commit -m "Release Lop Hoc Vui v3.0" || true
git push || true
echo ""
echo "[2/2] Dang deploy len Firebase Hosting..."
if command -v firebase >/dev/null 2>&1; then
  firebase deploy --only hosting
else
  npx firebase-tools deploy --only hosting
fi
echo ""
echo "========================================================"
echo "  HOAN TAT CAP NHAT LEN GITHUB & FIREBASE!"
echo "========================================================"
