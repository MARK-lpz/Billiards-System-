<?php
/*
 * SMS provider settings (Semaphore, https://semaphore.co).
 *
 * While the key is empty, password reset from the login screen is switched
 * off: a username and mobile number alone are not proof of identity. Put the
 * API key between the quotes below (or set the SEMAPHORE_API_KEY environment
 * variable) and reset by texted one-time code turns on. No other change is needed.
 */
define('SEMAPHORE_API_KEY', getenv('SEMAPHORE_API_KEY') ?: '');

// Optional. Must be a sender name approved in your Semaphore account;
// leave empty to use Semaphore's default sender.
define('SEMAPHORE_SENDER_NAME', getenv('SEMAPHORE_SENDER_NAME') ?: '');

// Only changed for testing against a local stand-in; leave unset otherwise.
define('SEMAPHORE_API_URL', getenv('SEMAPHORE_API_URL') ?: 'https://api.semaphore.co/api/v4/messages');

function smsIsConfigured(): bool
{
    return SEMAPHORE_API_KEY !== '';
}

/**
 * Accepts 09XXXXXXXXX, 639XXXXXXXXX or +639XXXXXXXXX and returns 09XXXXXXXXX,
 * or '' when it is not a Philippine mobile number.
 */
function normalizeMobileNumber(string $value): string
{
    $digits = preg_replace('/\D/', '', $value);
    if (preg_match('/^639\d{9}$/', $digits)) {
        $digits = '0' . substr($digits, 2);
    }
    return preg_match('/^09\d{9}$/', $digits) ? $digits : '';
}

/**
 * Sends one text. Returns true only when the provider accepted it.
 */
function sendSms(string $mobileNumber, string $message): bool
{
    if (!smsIsConfigured()) {
        return false;
    }

    $fields = [
        'apikey' => SEMAPHORE_API_KEY,
        'number' => $mobileNumber,
        'message' => $message,
    ];
    if (SEMAPHORE_SENDER_NAME !== '') {
        $fields['sendername'] = SEMAPHORE_SENDER_NAME;
    }

    $url = SEMAPHORE_API_URL;
    $body = http_build_query($fields);

    if (function_exists('curl_init')) {
        $curl = curl_init($url);
        curl_setopt_array($curl, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
        ]);
        $response = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);
    } else {
        $context = stream_context_create(['http' => [
            'method' => 'POST',
            'header' => 'Content-Type: application/x-www-form-urlencoded',
            'content' => $body,
            'timeout' => 15,
            'ignore_errors' => true,
        ]]);
        $response = @file_get_contents($url, false, $context);
        $status = 0;
        if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $match)) {
            $status = (int) $match[1];
        }
    }

    if ($response === false || $status < 200 || $status >= 300) {
        return false;
    }

    // A successful send comes back as a list of message records.
    $decoded = json_decode((string) $response, true);
    return is_array($decoded) && isset($decoded[0]['message_id']);
}
