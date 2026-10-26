from oldcape.index import IndexEntry, build_index


def test_build_index_shape():
    entries = [IndexEntry(12, 1, False), IndexEntry(3, 5, True)]
    idx = build_index(entries, {20: 3, 15: 12})
    assert idx == {
        "v": 1,
        "perSheet": 64,
        "cols": 8,
        "cell": [22, 17],
        "total": 2,
        "capes": [[3, 5, 1], [12, 1, 0]],
        "aliases": [[15, 12], [20, 3]],
    }
