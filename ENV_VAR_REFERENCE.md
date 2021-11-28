# Environment Variable Reference

| Variable                      | Default | Description                                                                                 |
| ----------------------------- | ------- | ------------------------------------------------------------------------------------------- |
| MDS_FN_CONTAINER_HOST         |         | The docker registry to obtain images from.                                                  |
| MDS_FN_CONTAINER_NETWORK      |         | A custom network to add containers to for execution.                                        |
| MDS_IDENTITY_URL              |         | The MDS Identity URL that is pre-configured in every container when it is built.            |
| MDS_MAX_STOPPED_CONTAINER_SEC | 60      | How long a container may be shutdown without being used before being removed from the host. |
| MDS_MAX_RUNNING_CONTAINER_SEC | 15      | How long a container may run while being unused before being eligible for shutdown.         |
| MDS_STOP_RUNNING_CONTAINERS   | true    | Use string "false" to leave containers running system after use. Useful for debugging.      |
| MDS_REMOVE_STOPPED_CONTAINERS | true    | Use string "false" to leave containers on system after use. Useful for debugging.           |