<?php
// Tournament pictures and videos. They are kept in backend/Media, beside api/
// and config/, under random names (see api/event_media.php). Media/ is not
// under api/, so the website gets each file through api/media.php.

const MEDIA_DIR = __DIR__ . '/../Media';
// How a tournament stores a file: "Media/<name>".
const MEDIA_PATH_PREFIX = 'Media/';
// A stored file's name: 32 hex characters and one of these extensions.
const MEDIA_FILE_PATTERN = '[a-f0-9]{32}\.(jpg|png|webp|gif|mp4|webm)';
const MEDIA_CONTENT_TYPES = [
    'jpg' => 'image/jpeg',
    'png' => 'image/png',
    'webp' => 'image/webp',
    'gif' => 'image/gif',
    'mp4' => 'video/mp4',
    'webm' => 'video/webm',
];
