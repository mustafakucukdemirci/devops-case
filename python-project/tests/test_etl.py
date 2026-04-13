import sys
import pytest
from unittest.mock import MagicMock, patch


def _fresh_import():
    """Remove cached module so each test gets a clean execution."""
    sys.modules.pop("ETL", None)
    import ETL  # noqa: F401


def test_calls_github_api():
    """ETL must hit the GitHub API root endpoint exactly once."""
    with patch("requests.get") as mock_get:
        mock_get.return_value = MagicMock(json=lambda: {"url": "https://api.github.com"})
        _fresh_import()
        mock_get.assert_called_once_with("https://api.github.com")


def test_raises_on_invalid_json():
    """If the API returns non-JSON, the script should propagate the error."""
    with patch("requests.get") as mock_get:
        mock_get.return_value = MagicMock(json=MagicMock(side_effect=ValueError("No JSON")))
        with pytest.raises(ValueError):
            _fresh_import()
