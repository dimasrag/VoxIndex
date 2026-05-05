import importlib, sys
try:
    importlib.import_module('indextts.infer_v2')
    print('IndexTTS2 import: OK')
except Exception as e:
    print('IndexTTS2 import: FAIL', e)
print('python exe:', sys.executable)
import os
cfg = os.path.join('..','index-tts','checkpoints','config.yaml')
print('Config exists:', os.path.exists(cfg), cfg)
