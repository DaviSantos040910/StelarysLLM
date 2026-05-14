import os, json
import subprocess
o = subprocess.check_output(['gcloud', 'logging', 'read', 'resource.type=cloud_run_revision AND resource.labels.service_name=backend-api AND severity>=ERROR', '--project', 'stellarys-lm', '--limit', '30', '--format=json'])
for x in json.loads(o):
  if 'textPayload' in x:
    print(x['textPayload'])
  else:
    print(x)
