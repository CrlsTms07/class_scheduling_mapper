<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Reset your password</title>
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
                            <p style="margin:0 0 12px;font-size:18px;font-weight:bold;color:#790D16;">Reset your password</p>
                            <p style="margin:0 0 12px;font-size:14px;line-height:1.5;">Hello {{ $name }},</p>
                            <p style="margin:0 0 20px;font-size:14px;line-height:1.5;">We received a request to reset the password of your account ({{ $email }}). Press the button to choose a new one.</p>
                            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
                                <tr>
                                    <td style="border-radius:8px;background:#790D16;">
                                        <a href="{{ $url }}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">Reset password</a>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#444;">This link is valid for <strong>{{ $minutes }} minutes</strong> and can be used once.</p>
                            <p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#444;">If you did not ask for this, you can ignore this email. Your password stays the same.</p>
                            <p style="margin:0;font-size:12px;line-height:1.5;color:#777;word-break:break-all;">If the button does not work, open this link: {{ $url }}</p>
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
