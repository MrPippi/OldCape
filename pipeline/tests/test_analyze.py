import pytest
from PIL import Image

from oldcape.analyze import COLOR_BUCKETS, assign_canonical, color_mask, is_blank
from oldcape.texture import REGION_SIZE

FRONT = (1, 1, 11, 17)


def bit(name: str) -> int:
    return 1 << COLOR_BUCKETS.index(name)


def region_with_front(*fills: tuple[str, int]) -> Image.Image:
    """Region whose 10x16 front is filled row-wise with (hex, row_count) bands."""
    img = Image.new("RGBA", REGION_SIZE, (0, 0, 0, 0))
    y = FRONT[1]
    for hex_colour, rows in fills:
        rgb = tuple(int(hex_colour[i:i + 2], 16) for i in (1, 3, 5))
        for _ in range(rows):
            for x in range(FRONT[0], FRONT[2]):
                img.putpixel((x, y), (*rgb, 255))
            y += 1
    return img


def test_bucket_order_is_fixed():
    assert COLOR_BUCKETS == ("red", "orange", "yellow", "green", "cyan", "blue",
                             "purple", "pink", "brown", "white", "gray", "black")


@pytest.mark.parametrize("hex_colour,name", [
    ("#e53935", "red"),
    ("#1e88e5", "blue"),
    ("#fafafa", "white"),
    ("#212121", "black"),
    ("#808080", "gray"),
    ("#795548", "brown"),
])
def test_single_colour(hex_colour, name):
    assert color_mask(region_with_front((hex_colour, 16))) == bit(name)


def test_two_colours_both_tagged():
    mask = color_mask(region_with_front(("#e53935", 8), ("#fdd835", 8)))
    assert mask == bit("red") | bit("yellow")


def test_minor_colour_below_threshold_ignored():
    # 10x16 front: 144 red pixels (90%) + 16 blue (10%) -> blue under 15%
    mask = color_mask(region_with_front(("#e53935", 14), ("#4b6be5", 2)))
    assert mask == bit("red")


def test_back_face_ignored():
    img = region_with_front(("#e53935", 16))
    for x in range(12, 22):
        for y in range(1, 17):
            img.putpixel((x, y), (30, 136, 229, 255))
    assert color_mask(img) == bit("red")


def test_transparent_region():
    img = Image.new("RGBA", REGION_SIZE, (0, 0, 0, 0))
    assert color_mask(img) == 0
    assert is_blank(img) is True


def test_two_distinct_colours_is_blank():
    img = Image.new("RGBA", REGION_SIZE, (200, 0, 0, 255))
    img.putpixel((3, 3), (0, 0, 200, 255))
    assert is_blank(img) is True


def test_three_distinct_colours_not_blank():
    img = Image.new("RGBA", REGION_SIZE, (200, 0, 0, 255))
    img.putpixel((3, 3), (0, 0, 200, 255))
    img.putpixel((4, 4), (0, 200, 0, 255))
    assert is_blank(img) is False


def test_assign_canonical_lowest_id_wins():
    assert assign_canonical({5: b"a", 3: b"a", 9: b"b"}) == {3: 3, 5: 3, 9: 9}
