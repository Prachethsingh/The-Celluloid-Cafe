"""Backend business logic services."""
from .notifications import (
    create_notification,
    delete_notification,
    get_unread_count,
    list_notifications,
    mark_all_read,
    mark_read,
)
from .playback import (
    check_playback_authorization,
    create_playback_token,
    generate_dash_manifest,
    generate_master_hls_manifest,
    generate_variant_hls_playlist,
    generate_webvtt_subtitles,
    get_quality_ladder,
    get_standard_subtitles,
    verify_playback_token,
)
from .recommendations import recommend, similar_titles
from .search import autocomplete, run_search
from .sync import (
    compute_hash,
    get_or_create,
    record_sync_complete,
    record_sync_start,
    upsert_with_change_detection,
)

__all__ = [
    "create_notification",
    "delete_notification",
    "get_unread_count",
    "list_notifications",
    "mark_all_read",
    "mark_read",
    "check_playback_authorization",
    "create_playback_token",
    "generate_dash_manifest",
    "generate_master_hls_manifest",
    "generate_variant_hls_playlist",
    "generate_webvtt_subtitles",
    "get_quality_ladder",
    "get_standard_subtitles",
    "verify_playback_token",
    "recommend",
    "similar_titles",
    "run_search",
    "autocomplete",
    "compute_hash",
    "record_sync_start",
    "record_sync_complete",
    "upsert_with_change_detection",
    "get_or_create",
]
