!include "FileFunc.nsh"
!include "LogicLib.nsh"
!include "getProcessInfo.nsh"

; 自定义运行检查后，模板不会再声明原进程检查使用的 pid。
Var pid

!ifndef BUILD_UNINSTALLER
; 从栈读取卷根目录和所需 KiB；不足时在旧版卸载前退出。
Function shroomRequireVolumeSpace
  Exch $0
  Exch
  Exch $1
  Push $2
  Push $3
  Push $4

  System::Call 'kernel32::GetDiskFreeSpaceExW(w r1, *l .r2, p 0, p 0) i.r3'
  ${If} $3 == 0
    DetailPrint "Cannot check installation or temporary disk space: $1"
    MessageBox MB_OK|MB_ICONSTOP "无法检查安装或临时解压磁盘：$1。旧版本尚未卸载，请重新运行安装程序并选择有效目录。" /SD IDOK
    SetErrorLevel 3
    Quit
  ${EndIf}

  System::Int64Op $0 * 1024
  Pop $4
  System::Int64Op $2 < $4
  Pop $3
  ${If} $3 != 0
    System::Int64Op $2 / 1048576
    Pop $2
    System::Int64Op $0 + 1023
    Pop $0
    System::Int64Op $0 / 1024
    Pop $0
    DetailPrint "Insufficient disk space at $1: available $2 MiB, required $0 MiB. Previous installation preserved."
    MessageBox MB_OK|MB_ICONSTOP "安装或临时解压磁盘空间不足：$1。需要至少 $0 MiB，当前可用 $2 MiB。旧版本尚未卸载，请清理空间，或重新运行安装程序选择其他磁盘。" /SD IDOK
    SetErrorLevel 112
    Quit
  ${EndIf}

  Pop $4
  Pop $3
  Pop $2
  Pop $1
  Pop $0
FunctionEnd

; 从栈读取临时、缓存目录，按实际卷合计目标、解压、压缩包与缓存空间。
Function shroomCheckInstallSpace
  Exch $0
  Exch
  Exch $1
  Push $2
  Push $3
  Push $4
  Push $5

  ${GetRoot} "$0" $2
  StrCpy $2 "$2\"
  ${GetRoot} "$1" $1
  StrCpy $1 "$1\"
  ${GetRoot} "$INSTDIR" $0
  StrCpy $0 "$0\"

  ; 多架构包取最大解压尺寸，Builder 提供的尺寸单位为 KiB。
  StrCpy $3 0
  !ifdef APP_64_UNPACKED_SIZE
    StrCpy $3 "${APP_64_UNPACKED_SIZE}"
  !endif
  !ifdef APP_ARM64_UNPACKED_SIZE
    System::Int64Op ${APP_ARM64_UNPACKED_SIZE} > $3
    Pop $4
    ${If} $4 != 0
      StrCpy $3 "${APP_ARM64_UNPACKED_SIZE}"
    ${EndIf}
  !endif
  !ifdef APP_32_UNPACKED_SIZE
    System::Int64Op ${APP_32_UNPACKED_SIZE} > $3
    Pop $4
    ${If} $4 != 0
      StrCpy $3 "${APP_32_UNPACKED_SIZE}"
    ${EndIf}
  !endif
  ; TEMP 同时容纳压缩包与解压目录；缓存大小保守按一份解压大小计算。
  StrCpy $4 1
  ${If} $0 == $1
    IntOp $4 $4 + 2
  ${EndIf}
  ${If} $0 == $2
    IntOp $4 $4 + 1
  ${EndIf}
  System::Int64Op $3 * $4
  Pop $5
  System::Int64Op $5 + 131072
  Pop $5
  Push $0
  Push $5
  Call shroomRequireVolumeSpace

  ${If} $1 != $0
    StrCpy $4 2
    ${If} $1 == $2
      IntOp $4 $4 + 1
    ${EndIf}
    System::Int64Op $3 * $4
    Pop $5
    System::Int64Op $5 + 131072
    Pop $5
    Push $1
    Push $5
    Call shroomRequireVolumeSpace
  ${EndIf}
  ${If} $2 != $0
  ${AndIf} $2 != $1
    System::Int64Op $3 + 131072
    Pop $5
    Push $2
    Push $5
    Call shroomRequireVolumeSpace
  ${EndIf}

  Pop $5
  Pop $4
  Pop $3
  Pop $2
  Pop $1
  Pop $0
FunctionEnd
!endif

; 此钩子在目录选择后、卸载旧版前执行，静默更新也经过这里。
!macro customCheckAppRunning
  !ifndef BUILD_UNINSTALLER
    ; 与模板复制安装器缓存时保持相同的当前用户 LOCALAPPDATA。
    ${If} $installMode == "all"
      SetShellVarContext current
    ${EndIf}
    Push "$TEMP"
    Push "$LOCALAPPDATA"
    ${If} $installMode == "all"
      SetShellVarContext all
    ${EndIf}
    Call shroomCheckInstallSpace
  !endif
  !insertmacro _CHECK_APP_RUNNING
!macroend
