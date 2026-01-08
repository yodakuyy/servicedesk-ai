@echo off
echo Mengupdate repository ke GitHub...
git add .
set /p commit_msg="Masukkan pesan commit (contoh: update fitur login): "
if "%commit_msg%"=="" set commit_msg="Update project automatic"
git commit -m "%commit_msg%"
git push origin main
echo.
echo Selesai! Project berhasil diupdate ke GitHub.
pause
