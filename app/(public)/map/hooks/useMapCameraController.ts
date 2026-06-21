'use client';

import { useCallback, useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import L from "leaflet";
import {
  getAutoRotationForVisibleRoad,
  getNearestRoadAlignedRotation,
  normalizeRotationDeg,
} from "../utils/autoRotation";
import type { MapRoutePoint } from "../types/mapRoute";

const AUTO_ROTATION_SNAP_THRESHOLD_DEG = 15;
const AUTO_ROTATION_COOLDOWN_MS = 3000;

type UseMapCameraControllerArgs = {
  mapRef: MutableRefObject<L.Map | null>;
  interactionDisabled: boolean;
  gestureActiveRef: MutableRefObject<boolean>;
  autoRotation: number;
  routePoints: MapRoutePoint[];
  isTracking: boolean;
  setIsTracking: (value: boolean) => void;
  setAutoRotation: (value: number) => void;
  /** true の間は自動回転調整（道に合わせたスナップ）を行わない */
  autoRotationDisabled?: boolean;
};

export function useMapCameraController({
  mapRef,
  interactionDisabled,
  gestureActiveRef,
  autoRotation,
  routePoints,
  isTracking,
  setIsTracking,
  setAutoRotation,
  autoRotationDisabled = false,
}: UseMapCameraControllerArgs) {
  const autoRotationCooldownUntilRef = useRef(0);

  const markManualRotation = useCallback(() => {
    autoRotationCooldownUntilRef.current = Date.now() + AUTO_ROTATION_COOLDOWN_MS;
  }, []);

  const snapRotationToVisibleRoad = useCallback(
    (center?: L.LatLng, forceNorthUp = false) => {
      if (autoRotationDisabled || interactionDisabled || gestureActiveRef.current) return;
      if (Date.now() < autoRotationCooldownUntilRef.current) return;
      const map = mapRef.current;
      if (!map) return;

      if (forceNorthUp) {
        setAutoRotation(0);
        return;
      }

      const targetRotation = getAutoRotationForVisibleRoad({
        center: center ?? map.getCenter(),
        routePoints,
      });
      if (targetRotation === null) {
        setAutoRotation(0);
        return;
      }

      const currentRotation = normalizeRotationDeg(autoRotation);
      const { rotation: snappedRotation, delta } = getNearestRoadAlignedRotation(
        currentRotation,
        targetRotation
      );
      if (Math.abs(delta) > AUTO_ROTATION_SNAP_THRESHOLD_DEG || Math.abs(delta) < 0.1) {
        return;
      }

      setAutoRotation(snappedRotation);
    },
    [autoRotation, autoRotationDisabled, gestureActiveRef, interactionDisabled, mapRef, routePoints, setAutoRotation]
  );

  useEffect(() => {
    if (!isTracking) return;
    const map = mapRef.current;
    if (!map) return;
    snapRotationToVisibleRoad(map.getCenter());
  }, [isTracking, mapRef, snapRotationToVisibleRoad]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleMoveEnd = () => {
      if (gestureActiveRef.current) return;
      snapRotationToVisibleRoad(map.getCenter());
    };

    const handleDragStart = () => {
      if (gestureActiveRef.current) return;
      setIsTracking(false);
    };

    map.on("dragstart", handleDragStart);
    map.on("moveend", handleMoveEnd);
    return () => {
      map.off("dragstart", handleDragStart);
      map.off("moveend", handleMoveEnd);
    };
  }, [gestureActiveRef, mapRef, setIsTracking, snapRotationToVisibleRoad]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!interactionDisabled) {
      map.dragging.disable();
      map.touchZoom.disable();
    }
  }, [interactionDisabled, mapRef]);

  return {
    markManualRotation,
    snapRotationToVisibleRoad,
  };
}
