#!/usr/bin/env sh

version="$1"
tag="latest"

if [[ $version =~ alpha ]]; then
  tag="alpha"
elif [[ $version =~ beta ]]; then
  tag="beta"
elif [[ $version =~ rc ]]; then
  tag="rc"
fi

echo "$tag"
