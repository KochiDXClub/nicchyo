import MapLoadingScreen from "../../components/MapLoadingScreen";

export default function Loading() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-b from-amber-50 via-orange-50 to-white text-gray-800">
      <MapLoadingScreen />
    </div>
  );
}
