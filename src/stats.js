// Handles logging and storing and stuff of statistics.

// For now only per session!
// TODO: Convert to a class

export let stats = {};

export function log_event(event_name) {
    if (stats[event_name])
        stats[event_name]++;
    else
        stats[event_name] = 1;

    return true;
}
