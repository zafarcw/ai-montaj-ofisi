#!/bin/bash
# Debug rejimda ishga tushirish (fayl so'rovlari jurnali)
export OFIS_DEBUG=1
exec "$(dirname "$0")/../start.command" --no-open
