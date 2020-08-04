function* braid(generator1: Generator, generator2: Generator): Generator {
    let first = generator1.next();
    let sec = generator2.next();

    while (!first.done && !sec.done) {
        yield first.value;
        yield sec.value;
        first = generator1.next();
        sec = generator2.next();
    }
    while (first.done && !sec.done) {
        yield sec.value;
        sec = generator2.next();
    }
    while (sec.done && !first.done) {
        yield first.value;
        first = generator1.next();
    }
}

function* biased(generator1: Generator, generator2: Generator): Generator {
    let first = generator1.next();
    let sec = generator2.next();

    while (!first.done && !sec.done) {
        yield first.value;
        if(!first.done){
            first = generator1.next();
            yield first.value
        }
        yield sec.value;
        first = generator1.next();
        sec = generator2.next();
    }
    while (first.done && !sec.done) {
        yield sec.value;
        sec = generator2.next();
    }
    while (sec.done && !first.done) {
        yield first.value;
        first = generator1.next();
    }
}