export interface Torrent {
    id: string;
    done: string;
    have: string;
    eta: string;
    up: string;
    down: string;
    ratio: string;
    status: string;
    name: string;
}

export interface TorrentSearch {
    name: string;
    magnet: string;
    seeders: string;
    leechers: string;
    size: string;
    date: string;
    files: string;
}