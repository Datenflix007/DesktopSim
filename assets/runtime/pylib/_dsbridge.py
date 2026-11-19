"""Brücke zwischen Python (Pyodide-Worker) und der DesktopSim-Oberfläche.

emit()  sammelt Oberflächen-Befehle (nicht blockierend, werden gebündelt verschickt),
call()  fragt synchron beim Hauptthread an (GUI-Ereignisse, Dialoge, virtuelles Netzwerk).
"""
import json

_post = None
_call = None
_can_block = lambda: False
try:  # im Pyodide-Worker
    import js as _js
    if hasattr(_js, 'dsGuiPost'):
        _post = _js.dsGuiPost
        _call = _js.dsCall
        _can_block = lambda: bool(_js.dsCanBlock())
except Exception:  # außerhalb von DesktopSim (z. B. Tests mit CPython)
    pass

_queue = []
_STATE_OPS = {'lb', 'tree', 'menu', 'value', 'corder', 'nb'}


def install(post, call, can_block=lambda: True):
    """Für Tests: eigene Rückruffunktionen setzen."""
    global _post, _call, _can_block
    _post, _call, _can_block = post, call, can_block


def emit(op, **kw):
    kw['op'] = op
    if op in _STATE_OPS:  # vollständige Zustände: ältere Einträge desselben Widgets verwerfen
        wid = kw.get('id')
        for i in range(len(_queue) - 1, -1, -1):
            if _queue[i]['op'] == op and _queue[i].get('id') == wid:
                del _queue[i]
                break
    _queue.append(kw)
    if len(_queue) > 400:
        flush()


def flush():
    if not _queue:
        return
    data = json.dumps(_queue, default=str)
    _queue.clear()
    if _post is not None:
        _post(data)


def call(op, **args):
    flush()
    if _call is None:
        return {'error': 'nosync'}
    try:
        return json.loads(str(_call(op, json.dumps(args, default=str))))
    except Exception as exc:  # pragma: no cover
        return {'error': str(exc)}


def can_block():
    try:
        return _call is not None and _can_block()
    except Exception:
        return False
