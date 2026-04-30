import os

try:
    from indextts.infer_v2 import IndexTTS2
    print('IndexTTS2 import: OK')
except Exception as e:
    print('IndexTTS2 import: FAIL', e)

cfg = os.path.join('..','index-tts','checkpoints','config.yaml')
print('Config exists:', os.path.exists(cfg), cfg)
try:
    ls = os.listdir(os.path.join('..','index-tts','checkpoints'))
    print('Some files:', ls[:10])
except Exception as e:
    print('List failed:', e)
