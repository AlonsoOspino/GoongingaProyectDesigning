package com.overtimeproductions.goonginga.familyfeud.game;

import java.io.IOException;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Component
public class FeudEvents {
    private final ConcurrentHashMap<String,Set<SseEmitter>> subscribers=new ConcurrentHashMap<>();
    public SseEmitter subscribe(String code,int version) {
        var emitter=new SseEmitter(0L);
        subscribers.computeIfAbsent(code,key -> ConcurrentHashMap.newKeySet()).add(emitter);
        Runnable remove=() -> subscribers.computeIfPresent(code,(key,set) -> {set.remove(emitter);return set.isEmpty()?null:set;});
        emitter.onCompletion(remove);emitter.onError(error -> remove.run());emitter.onTimeout(remove);
        try { emitter.send(SseEmitter.event().name("ready").data(java.util.Map.of("version",version))); }
        catch (IOException failure) { remove.run();emitter.completeWithError(failure); }
        return emitter;
    }
    public void publishAfterCommit(String code,int version) {
        if (TransactionSynchronizationManager.isSynchronizationActive())
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { publish(code,version); }
            });
        else publish(code,version);
    }
    public void publish(String code,int version) {
        for (SseEmitter emitter:subscribers.getOrDefault(code,Set.of())) {
            try { emitter.send(SseEmitter.event().name("refresh").data(java.util.Map.of("version",version))); }
            catch (IOException|IllegalStateException failure) { emitter.complete(); }
        }
    }
    @Scheduled(fixedDelay=20000)
    public void keepAlive() {
        for (Set<SseEmitter> emitters:subscribers.values()) for (SseEmitter emitter:emitters) {
            try { emitter.send(SseEmitter.event().comment("keep-alive")); }
            catch (IOException|IllegalStateException failure) { emitter.complete(); }
        }
    }
}
