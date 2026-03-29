@echo off
echo 1. Dang luu code len Git...
git add .
git commit -m "update"
git push
echo.
echo 2. Dang cap nhat web len Firebase...
firebase deploy --project xledu-dea6a
echo.
echo XONG! DA LUU GIT VA CAP NHAT WEB TREN MANG THANH CONG!
pause