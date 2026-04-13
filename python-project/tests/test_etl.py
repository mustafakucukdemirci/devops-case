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
        mock_get.return_value = MagicMock(json=lambda: {"current_user_url": "https://api.github.com/user"})
        _fresh_import()
        mock_get.assert_called_once_with("https://api.github.com")


def test_response_is_printed():
    """ETL must print both the response object and parsed JSON."""
    with patch("requests.get") as mock_get, patch("builtins.print") as mock_print:
        fake_json = {"current_user_url": "https://api.github.com/user"}
        fake_response = MagicMock()
        fake_response.json.return_value = fake_json
        mock_get.return_value = fake_response

        _fresh_import()

        assert mock_print.call_count >= 2


def test_raises_on_invalid_json():
    """If the API returns non-JSON, the script should propagate the error."""
    with patch("requests.get") as mock_get:
        mock_get.return_value = MagicMock(json=MagicMock(side_effect=ValueError("No JSON")))
        with pytest.raises(ValueError):
            _fresh_import()


def test_raises_on_network_error():
    """Network failures must surface — ETL should not silently swallow them."""
    import requests as req_module
    with patch("requests.get", side_effect=req_module.exceptions.ConnectionError("unreachable")):
        with pytest.raises(req_module.exceptions.ConnectionError):
            _fresh_import()


def test_api_url_is_correct():
    """Guard against typos in the GitHub API URL."""
    with patch("requests.get") as mock_get:
        mock_get.return_value = MagicMock(json=lambda: {})
        _fresh_import()
        called_url = mock_get.call_args[0][0]
        assert called_url == "https://api.github.com", f"Unexpected URL: {called_url}"
