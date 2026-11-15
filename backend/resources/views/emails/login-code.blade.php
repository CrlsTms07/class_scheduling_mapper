<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Your sign-in code</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#1f1f1f;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 12px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
                    <tr>
                        <td style="background:#790D16;padding:18px 24px;color:#ffffff;">
                            <table role="presentation" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="padding-right:12px;"><img src="{{ $logoUrl }}" width="44" height="44" alt="" style="display:block;border-radius:50%;background:#ffffff;"></td>
                                    <td>
                                        <div style="font-size:16px;font-weight:bold;">{{ $schoolName }}</div>
                                        <div style="font-size:12px;opacity:0.85;">ERCIHS Scheduling System</div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px;">
                            <p style="margin:0 0 12px;font-size:18px;font-weight:bold;color:#790D16;">Your sign-in code</p>
                            <p style="margin:0 0 12px;font-size:14px;line-height:1.5;">Hello {{ $name }},</p>
                            <p style="margin:0 0 16px;font-size:14px;line-height:1.5;">Use this code to finish signing in to your account ({{ $email }}):</p>
                            <p style="margin:0 0 16px;font-size:32px;font-weight:bold;letter-spacing:8px;color:#790D16;font-family:'Courier New',Courier,monospace;">{{ $code }}</p>
                            <p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#444;">It is valid for <strong>{{ $minutes }} minutes</strong>. Never share it: the school will never ask you for this code.</p>
                            <p style="margin:0;font-size:13px;line-height:1.5;color:#444;">If you were not signing in, someone may know your password. Change it after you sign in, or ask the Admin.</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:14px 24px;background:#fafafa;border-top:1px solid #eeeeee;font-size:11px;color:#777;line-height:1.5;">
                            {{ $schoolName }}@if ($address)<br>{{ $address }}@endif
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
