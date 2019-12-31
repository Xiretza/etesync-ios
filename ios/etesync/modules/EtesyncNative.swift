import Foundation
import EventKit

@objc(EteSyncNative)
class EteSyncNative: NSObject {
    let taskQueue = DispatchQueue(label: "com.etesync.DispatchQueue", attributes: .concurrent)
    
    @objc(hashEvent:resolve:reject:)
    func hashEvent(eventId: String, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
        let store = EKEventStore()
        if let event = store.calendarItem(withIdentifier: eventId) as! EKEvent? {
            resolve(etesync.hashEvent(event: event))
        } else {
            reject("no_event", String(format: "Event with identifier %@ not found", eventId), nil)
        }
    }
    
    @objc(calculateHashesForEvents:from:to:resolve:reject:)
    func calculateHashesForEvents(calendarId: String, from: NSNumber, to: NSNumber, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) -> Void {
        taskQueue.async {
            let store = EKEventStore()
            guard let cal = store.calendar(withIdentifier: calendarId) else {
                reject("no_calendar", String(format: "Calendar with identifier %@ not found", calendarId), nil)
                return
            }
            
            let start = Date(timeIntervalSince1970: TimeInterval(from.doubleValue))
            let end = Date(timeIntervalSince1970: TimeInterval(to.doubleValue))
            
            let predicate = store.predicateForEvents(withStart: start, end: end, calendars: [cal])
            
            let events = store.events(matching: predicate)
            
            var handled = Set<String>()
            var ret: [Any] = []
            
            for event in events {
                if (handled.contains(event.calendarItemIdentifier)) {
                    continue
                }
                handled.insert(event.calendarItemIdentifier)
                
                ret.append([
                    event.calendarItemIdentifier,
                    etesync.hashEvent(event: event)
                ])
            }
            
            resolve(ret)
        }
    }
}
