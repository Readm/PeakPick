"""Basic health check test for PeakPick ML backend."""


def test_import():
    """Verify the package can be imported."""
    from peakpick_ml import __version__
    assert __version__ == "0.1.0"


def test_server_import():
    """Verify the FastAPI server module can be imported."""
    from peakpick_ml.server import app
    assert app.title == "PeakPick ML Backend"
